import json, datetime as dt, pathlib, urllib.request, time
from concurrent.futures import ThreadPoolExecutor
ROOT=pathlib.Path(__file__).resolve().parents[1]/"data"
ROOT.mkdir(exist_ok=True)
def get(url):
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"NHL-MLB-Stats/1.0"}),timeout=45) as r:
                return json.load(r)
        except Exception:
            if i==3: raise
            time.sleep(2**i)
def load(name):
    p=ROOT/(name+".json")
    return json.loads(p.read_text()) if p.exists() else {}
def save(name,obj):
    p=ROOT/(name+".json")
    tmp=p.with_suffix(".tmp")
    tmp.write_text(json.dumps(obj,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    tmp.replace(p)
today=dt.date.today()
year=today.year
start=year if today.month>=9 else year-1
seasons=[str(y)+str(y+1) for y in (start-1,start)]
base="https://api-web.nhle.com/v1/"
def nhl():
    old=load("nhl")
    cache={g["id"]:g for g in old.get("games",[]) if g["season"] in seasons}
    standings=get(base+"standings/now")["standings"]
    teams={t["teamAbbrev"]["default"]:t["teamName"]["default"] for t in standings}
    def schedule(pair):
        team,s=pair
        return get(base+"club-schedule-season/"+team+"/"+s)["games"]
    with ThreadPoolExecutor(max_workers=5) as pool:
        schedules=list(pool.map(schedule,[(t,s) for t in teams for s in seasons]))
    games={g["id"]:g for batch in schedules for g in batch if g["gameType"]==2 and g["gameState"] in ("OFF","FINAL")}
    def box(g):
        b=get(base+"gamecenter/"+str(g["id"])+"/boxscore")
        players=[]
        for side in ("homeTeam","awayTeam"):
            for group in ("forwards","defense"):
                for p in b["playerByGameStats"][side][group]:
                    if p.get("toi","0:00")=="0:00": continue
                    players.append([p["playerId"],p["name"]["default"],b[side]["abbrev"],p["goals"],p["points"]])
        return dict(id=g["id"],season=str(g["season"]),date=g["gameDate"],home=g["homeTeam"]["abbrev"],away=g["awayTeam"]["abbrev"],players=players)
    missing=[g for k,g in games.items() if k not in cache]
    with ThreadPoolExecutor(max_workers=5) as pool:
        for g in pool.map(box,missing): cache[g["id"]]=g
    names=old.get("names",{})
    ids={p[0] for g in cache.values() for p in g["players"]}
    def full_name(pid):
        try:
            p=get(base+"player/"+str(pid)+"/landing")
            return str(pid),p["firstName"]["default"]+" "+p["lastName"]["default"]
        except Exception:
            return str(pid),None
    with ThreadPoolExecutor(max_workers=5) as pool:
        for pid,name in pool.map(full_name,[i for i in ids if str(i) not in names]):
            if name: names[pid]=name
    schedule_games={g["id"]:dict(date=g["gameDate"],home=g["homeTeam"]["abbrev"],away=g["awayTeam"]["abbrev"]) for batch in schedules for g in batch if g["gameType"]==2 and str(g["season"])==seasons[-1] and g.get("gameScheduleState") not in ("PPD","CNCL")}
    save("nhl",dict(teams=teams,seasons=seasons,names=names,schedule=list(schedule_games.values()),games=list(cache.values()),updated=dt.datetime.now(dt.timezone.utc).isoformat()))
def mlb():
    seasons=[str(year-1),str(year)]
    base="https://statsapi.mlb.com/api/v1/"
    teams={str(t["id"]):t["name"] for t in get(base+"teams?sportId=1&season="+str(year))["teams"]}
    games=[]
    for s in seasons:
        data=get(base+"schedule?sportId=1&gameType=R&season="+s+"&startDate="+s+"-01-01&endDate="+s+"-12-31")
        for day in data["dates"]:
            for g in day["games"]:
                if g["status"]["abstractGameState"]!="Final": continue
                h,a=g["teams"]["home"],g["teams"]["away"]
                if "score" not in h or "score" not in a: continue
                games.append(dict(id=g["gamePk"],season=s,date=g["officialDate"],home=str(h["team"]["id"]),away=str(a["team"]["id"]),hr=h["score"],ar=a["score"]))
    save("mlb",dict(teams=teams,seasons=seasons,games=games,updated=dt.datetime.now(dt.timezone.utc).isoformat()))
if __name__=="__main__":
    mlb()
    nhl()
