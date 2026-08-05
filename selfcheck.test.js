/* ============================================================================
   GeoMeasure G 자체 점검 — 거리·면적·GeoJSON 검증 로직
   ----------------------------------------------------------------------------
   실행: node selfcheck.test.js   (의존성 없음, 프레임워크 없음)
   · 거리 기준값은 GeoMeasure K 와 같은 용춘목장 실측이다. 두 판이 같은 값을
     내야 GeoJSON 을 주고받는 의미가 있으므로, 여기가 틀리면 호환이 깨진 것이다.
   · 지도 SDK·DOM 은 최소 스텁만 둔다. 브라우저 동작이 아니라 "깨지면 조용히
     틀린 값을 내는" 순수 로직만 대상으로 한다.
   · G 는 Google Maps API 키를 확보하기 전에 작성됐다 — 지도 렌더는 미검증이고,
     이 파일이 유일한 자동 검증 수단이다.
   · 브라우저에서 거리만 빠르게 보려면 index.html?selfcheck=1 도 그대로 쓴다.
   ============================================================================ */
const fs=require('fs'), vm=require('vm'), assert=require('assert');
// 사본을 두면 코드와 갈라진다 — index.html 의 인라인 스크립트를 매번 그대로 뽑아 쓴다.
const html=fs.readFileSync(__dirname+'/index.html','utf8');
// \r? 는 윈도우 체크아웃(CRLF) 대비다. 이게 없으면 리눅스에서만 돌아가는 테스트가 된다.
const m=html.match(/<script>\r?\n([\s\S]*)\r?\n<\/script>/);
if(!m){ console.error('index.html 에서 인라인 스크립트를 찾지 못했습니다'); process.exit(1); }
const src=m[1];

const el=()=>({value:'', textContent:'', innerHTML:'', checked:true, style:{},
               classList:{toggle(){},add(){},remove(){}}, addEventListener(){}, dataset:{}});
const ctx={
  window:{}, location:{search:'', origin:'http://x'},
  document:{getElementById:el, querySelectorAll:()=>[], querySelector:()=>null,
            createElement:el, head:{appendChild(){}}, body:{appendChild(){}}, addEventListener(){}},
  localStorage:{getItem:()=>null, setItem(){}},
  // console 을 그대로 넘기면 소스의 console.error 재정의(구글 오류를 화면으로
  // 끌어올리는 코드)가 실제 콘솔을 덮어쓴다 — 사본을 넘겨 테스트를 격리한다.
  console:Object.assign({}, console),
  setTimeout, clearTimeout, URLSearchParams, Blob:class{}, FileReader:class{},
  navigator:{}, Math, Date, JSON, isFinite, parseFloat, parseInt, String, Number, Array, Object,
};
ctx.globalThis=ctx;
vm.createContext(ctx);
vm.runInContext(src, ctx);

// 최상위 const/let 은 샌드박스 객체의 프로퍼티가 되지 않는다(function 만 된다).
// esc·safeColor 같은 화살표 상수는 컨텍스트 안에서 식을 실행해 꺼낸다.
const run = expr => vm.runInContext(expr, ctx);
// realm 이 달라 프로토타입이 다르므로 deepStrictEqual 대신 필드를 직접 본다.
const eqPt = (p,lat,lng) => assert.ok(p && p.lat===lat && p.lng===lng, JSON.stringify(p));

let pass=0, fail=0;
const t=(name,fn)=>{ try{ fn(); pass++; console.log('PASS  '+name); }
                     catch(e){ fail++; console.log('FAIL  '+name+'\n      '+e.message); } };

// ---- 1. 거리: 용춘목장 실측 (K 와 동일해야 한다) ----
const A={lat:33.4011689,lng:126.3664674},
      B={lat:33.4022213,lng:126.3647669},
      C={lat:33.4042634,lng:126.3655233};
t('A↔B 196.7 m', ()=>assert.ok(Math.abs(ctx.haversine(A,B)-196.7)<=0.1, ctx.haversine(A,B).toFixed(1)));
t('B↔C 237.9 m', ()=>assert.ok(Math.abs(ctx.haversine(B,C)-237.9)<=0.1, ctx.haversine(B,C).toFixed(1)));
t('C↔A 355.5 m', ()=>assert.ok(Math.abs(ctx.haversine(C,A)-355.5)<=0.1, ctx.haversine(C,A).toFixed(1)));
// 구면 반경 상수를 흔한 평균반경으로 바꾸면 K 와 값이 갈린다 — 상수 자체를 못 박는다
t('지구 반경은 WGS84 적도반경(K 와 동일)', ()=>{
  const oneDeg=ctx.haversine({lat:0,lng:0},{lat:0,lng:1});
  assert.ok(Math.abs(oneDeg-111319.49)<1, oneDeg.toFixed(2)+' m/도');
});

// ---- 2. 면적: 위도 33°에서 한 변 약 100 m 인 정사각형 ≈ 10,000 ㎡ ----
t('면적 100m×100m ≈ 1만 ㎡', ()=>{
  const d=100/111320, dl=100/(111320*Math.cos(33.4*Math.PI/180));
  const sq=[{lat:33.4,lng:126.36},{lat:33.4,lng:126.36+dl},
            {lat:33.4+d,lng:126.36+dl},{lat:33.4+d,lng:126.36}];
  const a=ctx.polyArea(sq);
  assert.ok(Math.abs(a-10000)<100, a.toFixed(0)+' ㎡');
});
t('면적: 꼭짓점 2개면 0', ()=>assert.strictEqual(ctx.polyArea([{lat:1,lng:1},{lat:2,lng:2}]),0));
t('면적: 감김 방향 무관(절댓값)', ()=>{
  const p=[{lat:33.4,lng:126.36},{lat:33.401,lng:126.36},{lat:33.401,lng:126.361}];
  assert.ok(Math.abs(ctx.polyArea(p)-ctx.polyArea(p.slice().reverse()))<1e-6);
});

// ---- 2-1. 측위 오차 → 화면 배율 (센서는 틀어진다) ----
t('accBox: ±100 m 면 상하 약 100 m 씩', ()=>{
  const b=ctx.accBox(33.4,126.36,100);
  const up=ctx.haversine({lat:33.4,lng:126.36},{lat:b.ne.lat,lng:126.36});
  assert.ok(Math.abs(up-100)<2, up.toFixed(1)+' m');
});
t('accBox: ±20 km 면 상하 약 20 km 씩(과확대 방지의 근거)', ()=>{
  const b=ctx.accBox(33.4,126.36,20000);
  const up=ctx.haversine({lat:33.4,lng:126.36},{lat:b.ne.lat,lng:126.36});
  assert.ok(Math.abs(up-20000)<300, up.toFixed(1)+' m');
});
t('accBox: 경도 폭이 위도로 보정된다(고위도에서 더 넓음)', ()=>{
  const lo=ctx.accBox(0,126.36,1000), hi=ctx.accBox(60,126.36,1000);
  assert.ok((hi.ne.lng-hi.sw.lng) > (lo.ne.lng-lo.sw.lng)*1.9);
});
t('accBox: 극지방에서도 발산하지 않는다', ()=>{
  const b=ctx.accBox(89.999,0,1000);
  assert.ok(isFinite(b.ne.lng) && Math.abs(b.ne.lng)<=180*10, String(b.ne.lng));
});
// 해외판이라 남반구 좌표가 실제로 들어온다 — 부호가 뒤집혀도 폭이 같아야 한다
t('accBox: 남반구에서도 대칭(해외 현장)', ()=>{
  const s=ctx.accBox(-25.2637,-57.5759,500), n=ctx.accBox(25.2637,-57.5759,500);
  assert.ok(Math.abs((s.ne.lng-s.sw.lng)-(n.ne.lng-n.sw.lng))<1e-9);
});
t('accMessage: 1 km 초과는 km 표기 + 신뢰 경고', ()=>{
  const m=ctx.accMessage(23000);
  assert.ok(m.indexOf('23.0 km')>=0, m);
  assert.ok(m.indexOf('믿지 마세요')>=0, m);
});
t('accMessage: 100 m 이하는 경고 없이 값만', ()=>{
  const m=ctx.accMessage(12.3);
  assert.strictEqual(m,'정확도 ±12.3 m');
});

// ---- 3. 이스케이프·색 검증 (신뢰 경계) ----
t('esc: 스크립트 태그 무력화', ()=>
  assert.strictEqual(run('esc("<img src=x onerror=alert(1)>")'),
    '&lt;img src=x onerror=alert(1)&gt;'));
t('esc: 따옴표(속성 탈출) 차단', ()=>
  assert.strictEqual(run('esc(\'" onmouseover="evil()\')'), '&quot; onmouseover=&quot;evil()'));
t('safeColor: 정상 통과', ()=>assert.strictEqual(run('safeColor("#4cd07d","#000")'),'#4cd07d'));
t('safeColor: CSS 주입 거부', ()=>
  assert.strictEqual(run('safeColor("red;background:url(javascript:1)","#000")'),'#000'));
t('safeColor: 빈값/숫자 거부', ()=>{
  assert.strictEqual(run('safeColor("","#000")'),'#000');
  assert.strictEqual(run('safeColor(123,"#000")'),'#000');
});

// ---- 4. GeoJSON 파싱: 정상 왕복 ----
const good={type:'FeatureCollection', name:'용춘목장', features:[
  {type:'Feature',geometry:{type:'Point',coordinates:[126.3664674,33.4011689]},
   properties:{kind:'gw',radius:350,label:'A',color:'#38b6ff'}},
  {type:'Feature',geometry:{type:'Polygon',coordinates:[[[126.36,33.40],[126.361,33.40],[126.361,33.401],[126.36,33.401],[126.36,33.40]]]},
   properties:{kind:'area',name:'방목지1',desc:'남측',fillColor:'#4cd07d',strokeColor:'#4cd07d',opacity:0.3,labelPos:[126.3605,33.4005]}},
  {type:'Feature',geometry:{type:'Point',coordinates:[126.365,33.402]},
   properties:{kind:'text',text:'급수대',fontSize:16}},
  {type:'Feature',geometry:{type:'LineString',coordinates:[[126.36,33.40],[126.37,33.41]]},
   properties:{kind:'route'}},
]};
t('정상 파일: 지점1·영역1·텍스트1', ()=>{
  const {log,out}=ctx.parseGeoJSON(good);
  assert.strictEqual(out.pts.length,1);
  assert.strictEqual(out.areas.length,1);
  assert.strictEqual(out.texts.length,1);
  assert.strictEqual(log.length,0, '경고 '+JSON.stringify(log));
});
t('반경은 보존(사용자 지정값)', ()=>assert.strictEqual(ctx.parseGeoJSON(good).out.radius,350));

// ---- 4-1. GeoMeasure K 호환 (두 판이 파일을 주고받는다) ----
/* K 가 내보낸 파일에는 properties.app 이 'GeoMeasure K' 로 찍힌다. 불러오기가
   이 값을 검사하면 국내판 파일이 여기서 거부된다 — 검사하지 않는 게 설계다. */
const fromK={type:'FeatureCollection', name:'색달목장',
  properties:{app:'GeoMeasure K', version:1, ranch:'색달목장', created:'2026-08-05'},
  features:[
    {type:'Feature',geometry:{type:'Point',coordinates:[126.3664674,33.4011689]},
     properties:{kind:'gw',radius:350,label:'A',name:'본관 GW',color:'#38b6ff'}},
    {type:'Feature',geometry:{type:'Polygon',coordinates:[[[126.36,33.40],[126.361,33.40],[126.361,33.401],[126.36,33.40]]]},
     properties:{kind:'area',name:'방목지 5',desc:'거의 사용 안함',
                 fillColor:'#ff6b6b',strokeColor:'#ff6b6b',opacity:0.25,labelPos:[126.3605,33.4005]}},
  ]};
t('K 가 내보낸 파일을 그대로 읽는다', ()=>{
  const {log,out}=ctx.parseGeoJSON(fromK);
  assert.strictEqual(out.pts.length,1);
  assert.strictEqual(out.areas.length,1);
  assert.strictEqual(out.ranch,'색달목장');
  assert.strictEqual(log.length,0, '경고 '+JSON.stringify(log));
});
t('K 파일의 지점 이름·반경·영역 스타일이 살아남는다', ()=>{
  const {out}=ctx.parseGeoJSON(fromK);
  assert.strictEqual(out.pts[0].name,'본관 GW');
  assert.strictEqual(out.radius,350);
  assert.strictEqual(out.areas[0].name,'방목지 5');
  assert.strictEqual(out.areas[0].desc,'거의 사용 안함');
  assert.strictEqual(out.areas[0].style.fillColor,'#ff6b6b');
  assert.ok(Math.abs(out.areas[0].style.opacity-0.25)<1e-9);
});
t('app 필드는 검사하지 않는다(모르는 값이어도 읽힌다)', ()=>{
  const alien=JSON.parse(JSON.stringify(fromK));
  alien.properties.app='어떤 다른 도구';
  assert.strictEqual(ctx.parseGeoJSON(alien).out.pts.length,1);
});
t('링 좌표 순서는 [경도, 위도] — 뒤바뀌면 면적이 0 이 아니라 거부된다', ()=>{
  // GeoJSON 은 [lng,lat] 순서다. K 와 순서가 어긋나면 좌표가 통째로 잘못 읽힌다.
  const {out}=ctx.parseGeoJSON(fromK);
  assert.ok(Math.abs(out.pts[0].lat-33.4011689)<1e-9, '위도가 뒤바뀌었다');
  assert.ok(Math.abs(out.pts[0].lng-126.3664674)<1e-9, '경도가 뒤바뀌었다');
});

// ---- 지점 이름: 사용자 데이터라 왕복해야 한다 (label·color 는 순서에서 파생) ----
t('지점 이름 보존', ()=>{
  const {out}=ctx.parseGeoJSON({type:'FeatureCollection',features:[
    {type:'Feature',geometry:{type:'Point',coordinates:[126.36,33.4]},
     properties:{kind:'gw',label:'A',name:'본관 GW',color:'#38b6ff'}}]});
  assert.strictEqual(out.pts[0].name,'본관 GW');
});
t('이름 없으면 빈 문자열(글자로 대체는 표시 단계에서)', ()=>{
  const {out}=ctx.parseGeoJSON({type:'FeatureCollection',features:[
    {type:'Feature',geometry:{type:'Point',coordinates:[126.36,33.4]},properties:{kind:'gw'}}]});
  assert.strictEqual(out.pts[0].name,'');
});
t('지점 이름 40자 초과는 잘림', ()=>{
  const {out}=ctx.parseGeoJSON({type:'FeatureCollection',features:[
    {type:'Feature',geometry:{type:'Point',coordinates:[126.36,33.4]},
     properties:{kind:'gw',name:'가'.repeat(500)}}]});
  assert.strictEqual(out.pts[0].name.length,40);
});
t('지점 이름이 문자열이 아니면 무시', ()=>{
  const {out}=ctx.parseGeoJSON({type:'FeatureCollection',features:[
    {type:'Feature',geometry:{type:'Point',coordinates:[126.36,33.4]},
     properties:{kind:'gw',name:{evil:1}}}]});
  assert.strictEqual(out.pts[0].name,'');
});
t('지점 이름의 스크립트는 이스케이프된다', ()=>{
  const {out}=ctx.parseGeoJSON({type:'FeatureCollection',features:[
    {type:'Feature',geometry:{type:'Point',coordinates:[126.36,33.4]},
     properties:{kind:'gw',name:'<script>alert(1)</script>'}}]});
  // 파싱은 원문을 보존하고, DOM 에 넣을 때 esc() 가 막는다
  assert.ok(run('esc('+JSON.stringify(out.pts[0].name)+')').indexOf('<script')===-1);
});
t('목장명 보존', ()=>assert.strictEqual(ctx.parseGeoJSON(good).out.ranch,'용춘목장'));
t('LineString 은 무시(파생값)', ()=>{
  // 경로가 지점으로 재생성되므로 파싱 결과에 별도 항목이 없어야 한다
  const {out}=ctx.parseGeoJSON(good);
  assert.strictEqual(out.pts.length,1);
});
t('Polygon 닫힘점 제거', ()=>{
  const {out}=ctx.parseGeoJSON(good);
  assert.strictEqual(out.areas[0].path.length,4);   // 링 5점 → 표시용 4점
});

// ---- 5. GeoJSON 파싱: 손상·악의적 입력 (조용히 깨지면 안 된다) ----
t('최상위가 배열이면 중단 + 사유', ()=>{
  const {log,out}=ctx.parseGeoJSON([1,2,3]);
  assert.ok(log.length>0); assert.strictEqual(out.areas.length,0);
});
t('features 없으면 중단 + 사유', ()=>{
  const {log}=ctx.parseGeoJSON({type:'FeatureCollection'});
  assert.ok(log.some(m=>m.includes('features')));
});
t('위경도 뒤바뀐 좌표 거부', ()=>{
  const {log,out}=ctx.parseGeoJSON({type:'FeatureCollection',features:[
    {type:'Feature',geometry:{type:'Point',coordinates:[33.4,126.36]},properties:{kind:'gw'}}]});
  assert.strictEqual(out.pts.length,0, '위도 126 은 통과하면 안 된다');
  assert.ok(log.length>0);
});
t('NaN·문자열 좌표 거부', ()=>{
  const {out}=ctx.parseGeoJSON({type:'FeatureCollection',features:[
    {type:'Feature',geometry:{type:'Point',coordinates:['126.3','33.4']},properties:{}},
    {type:'Feature',geometry:{type:'Point',coordinates:[NaN,33.4]},properties:{}}]});
  assert.strictEqual(out.pts.length,0);
});
// 해외판이라 음수 좌표(서반구·남반구)가 정상 입력이다 — 거부하면 안 된다
t('남미 좌표(음수 위·경도)는 정상 통과', ()=>{
  const {log,out}=ctx.parseGeoJSON({type:'FeatureCollection',features:[
    {type:'Feature',geometry:{type:'Point',coordinates:[-57.5759,-25.2637]},
     properties:{kind:'gw',radius:350}}]});
  assert.strictEqual(out.pts.length,1);
  assert.ok(Math.abs(out.pts[0].lat+25.2637)<1e-9);
  assert.ok(Math.abs(out.pts[0].lng+57.5759)<1e-9);
  assert.strictEqual(log.length,0, '경고 '+JSON.stringify(log));
});
t('꼭짓점 3개 미만 폴리곤 건너뜀', ()=>{
  const {log,out}=ctx.parseGeoJSON({type:'FeatureCollection',features:[
    {type:'Feature',geometry:{type:'Polygon',coordinates:[[[126.36,33.4],[126.37,33.4]]]},properties:{kind:'area'}}]});
  assert.strictEqual(out.areas.length,0);
  assert.ok(log.some(m=>m.includes('3개 미만')));
});
t('악성 색상은 기본색으로 대체', ()=>{
  const {out}=ctx.parseGeoJSON({type:'FeatureCollection',features:[
    {type:'Feature',geometry:{type:'Polygon',coordinates:[[[126.36,33.4],[126.37,33.4],[126.37,33.41]]]},
     properties:{kind:'area',fillColor:'url(javascript:alert(1))'}}]});
  assert.strictEqual(out.areas[0].style.fillColor,'#4cd07d');
});
t('반경 이상값 클램프', ()=>{
  const {out}=ctx.parseGeoJSON({type:'FeatureCollection',features:[
    {type:'Feature',geometry:{type:'Point',coordinates:[126.36,33.4]},properties:{kind:'gw',radius:1e9}}]});
  assert.strictEqual(out.radius,100000);
});
t('반경 불일치 시 첫 값으로 통일 + 사유', ()=>{
  const {log,out}=ctx.parseGeoJSON({type:'FeatureCollection',features:[
    {type:'Feature',geometry:{type:'Point',coordinates:[126.36,33.4]},properties:{kind:'gw',radius:350}},
    {type:'Feature',geometry:{type:'Point',coordinates:[126.37,33.4]},properties:{kind:'gw',radius:500}}]});
  assert.strictEqual(out.radius,350);
  assert.ok(log.some(m=>m.includes('통일')));
});
t('긴 문자열 잘림(DoS 방어)', ()=>{
  const {out}=ctx.parseGeoJSON({type:'FeatureCollection',features:[
    {type:'Feature',geometry:{type:'Polygon',coordinates:[[[126.36,33.4],[126.37,33.4],[126.37,33.41]]]},
     properties:{kind:'area',name:'가'.repeat(5000)}}]});
  assert.strictEqual(out.areas[0].name.length,60);
});
t('알 수 없는 geometry 는 사유 남기고 건너뜀', ()=>{
  const {log}=ctx.parseGeoJSON({type:'FeatureCollection',features:[
    {type:'Feature',geometry:{type:'MultiPolygon',coordinates:[]},properties:{}}]});
  assert.ok(log.some(m=>m.includes('MultiPolygon')));
});
t('null·빈 feature 는 사유 남기고 건너뜀', ()=>{
  const {log,out}=ctx.parseGeoJSON({type:'FeatureCollection',features:[null,{},{type:'Feature'}]});
  assert.strictEqual(out.pts.length,0);
  assert.strictEqual(log.length,3);
});

// ---- 6. 드로잉 좌표 정규화 (SDK 경계 흡수) ----
/* 구글 Polygon.getPath().getArray() 는 LatLng 객체를 준다 — lat()/lng() 가
   "메서드"라는 점이 카카오(getLat()/getLng())와 다르고, 이름만 같고 값이 아닌
   함수라 그대로 쓰면 조용히 [object Function] 이 된다. 여기서 흡수한다. */
t('normPath: 구글 LatLng(lat()/lng() 메서드)', ()=>{
  const ll=(la,ln)=>({lat:()=>la, lng:()=>ln});
  const p=ctx.normPath([ll(33.4,126.36), ll(33.41,126.37)]);
  assert.strictEqual(p.length,2);
  eqPt(p[0],33.4,126.36);
});
t('normPath: {lat,lng} 리터럴', ()=>
  eqPt(ctx.normPath([{lat:33.4,lng:126.36}])[0],33.4,126.36));
t('normPath: 범위 밖 좌표 제거', ()=>
  assert.strictEqual(ctx.normPath([{lat:999,lng:999},{lat:33.4,lng:126.36}]).length,1));
t('normPath: 배열 아니면 빈 배열', ()=>
  assert.strictEqual(ctx.normPath(undefined).length,0));
t('normPath: 결과가 면적 계산에 그대로 들어간다', ()=>{
  const ll=(la,ln)=>({lat:()=>la, lng:()=>ln});
  const p=ctx.normPath([ll(33.40,126.36), ll(33.40,126.37), ll(33.41,126.37)]);
  assert.strictEqual(p.length,3);
  assert.ok(ctx.polyArea(p)>0, '면적이 0이면 위경도가 뒤바뀐 것');
});
t('normPath: 남반구 좌표도 통과(해외 현장)', ()=>{
  const ll=(la,ln)=>({lat:()=>la, lng:()=>ln});
  eqPt(ctx.normPath([ll(-25.2637,-57.5759)])[0],-25.2637,-57.5759);
});

// ---- 7. 링 닫힘 ----
t('ringOf: 첫 점과 끝 점이 같아진다', ()=>{
  const r=ctx.ringOf([{lat:33.4,lng:126.36},{lat:33.41,lng:126.36},{lat:33.41,lng:126.37}]);
  assert.strictEqual(r.length,4);
  assert.ok(r[0][0]===r[3][0] && r[0][1]===r[3][1], '링이 닫히지 않았다');
});
t('ringOf: 이미 닫혀 있으면 그대로', ()=>{
  const p=[{lat:33.4,lng:126.36},{lat:33.41,lng:126.36},{lat:33.41,lng:126.37},{lat:33.4,lng:126.36}];
  assert.strictEqual(ctx.ringOf(p).length,4);
});
t('ringOf: GeoJSON 은 [경도, 위도] 순서', ()=>{
  const r=ctx.ringOf([{lat:33.4,lng:126.36},{lat:33.41,lng:126.36},{lat:33.41,lng:126.37}]);
  assert.strictEqual(r[0][0],126.36);   // 경도가 먼저
  assert.strictEqual(r[0][1],33.4);
});

console.log('\n'+(fail?('실패 '+fail+'건 / '):'')+'통과 '+pass+'건');
process.exit(fail?1:0);
