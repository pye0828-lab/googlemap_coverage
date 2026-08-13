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
  // pathname 은 gdShareURL() 이 공유 주소를 조립하는 데 쓴다(§드라이브)
  window:{}, location:{search:'', origin:'http://x', pathname:'/'},
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

/* ---- 텍스트 사진: pid 가 곧 사진의 주인 열쇠다 ----
   pid 를 흘리면 파일을 다시 열었을 때 사진이 미아가 되고, 그건 화면에
   "사진이 없다"로만 보여서 조용히 유실된다. 왕복을 여기서 잡는다. */
const T1PX='data:image/png;base64,iVBORw0KGgo=';
t('텍스트 pid·사진 왕복', ()=>{
  const {out}=ctx.parseGeoJSON({type:'FeatureCollection',features:[
    {type:'Feature',geometry:{type:'Point',coordinates:[126.365,33.402]},
     properties:{kind:'text',text:'배선 주의',fontSize:16,pid:'abc123',
                 photos:[{uri:T1PX,name:'배선.jpg'}]}}]});
  assert.strictEqual(out.texts[0].pid,'abc123');
  assert.strictEqual(out.texts[0].photos.length,1);
  assert.strictEqual(out.texts[0].photos[0].name,'배선.jpg');
});
t('pid 없는 구버전 텍스트는 null (불러올 때 새로 만든다)', ()=>{
  const {out}=ctx.parseGeoJSON(good);
  assert.strictEqual(out.texts[0].pid,null);
  assert.strictEqual(out.texts[0].photos.length,0);
});
/* 하향호환은 사용자가 명시적으로 요구한 성질이다. pid·photos 가 없던 시절의
   파일을 열었을 때 경고가 한 건이라도 뜨면, 멀쩡한 파일을 사용자가 손상된
   것으로 오해한다 — 조용히 깨지는 자리라 여기에 못을 박는다.
   K 가 내보낸 파일도 이 경로로 들어온다(§5.1 파일 호환). */
t('구버전 파일(pid·photos 없음)은 경고 0건으로 읽힌다', ()=>{
  const {log,out}=ctx.parseGeoJSON(good);
  assert.strictEqual(log.length,0,'경고: '+JSON.stringify(log));
  assert.strictEqual(out.pts[0].pid,null);
  assert.strictEqual(out.pts[0].photos.length,0);
});
t('텍스트 사진도 지점과 같은 검증을 탄다(2MB 초과 거부)', ()=>{
  const big='data:image/png;base64,'+'A'.repeat(2*1024*1024);
  const {out}=ctx.parseGeoJSON({type:'FeatureCollection',features:[
    {type:'Feature',geometry:{type:'Point',coordinates:[126.365,33.402]},
     properties:{kind:'text',text:'x',pid:'p1',photos:[{uri:big}]}}]});
  assert.strictEqual(out.texts[0].photos.length,0);
});

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

// ---- 4-2. 지점 사진 (K @ dcc69a1·7ea3b12 에서 이식) ----
// 사진은 파일 하나로 오가는 게 절대 조건이라 왕복(export→import)이 깨지면 안 되고,
// 외부 파일의 문자열이 <img src> 로 DOM 에 꽂히는 경로라 검증도 함께 본다.
// 값은 K 와 같아야 한다 — 두 판이 사진이 붙은 파일을 서로 열어야 하기 때문이다.
const JPG='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAg=';
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
// 최상위 let 인 pts 는 샌드박스 프로퍼티가 아니라 컨텍스트 안에서 채워 넣는다
run('function __setPts(a){ pts.length=0; a.forEach(x=>pts.push(x)); }');
const roundTrip = (photoMap) => {
  ctx.__setPts([{lat:33.4011689,lng:126.3664674,name:'A동 GW',pid:'abc123',photos:[]}]);
  const gj=ctx.buildGeoJSON(photoMap);
  return {gj, back:ctx.parseGeoJSON(JSON.parse(JSON.stringify(gj)))};   // 파일을 거친 것과 같게
};

const badPhotos = arr => ctx.parseGeoJSON({type:'FeatureCollection',features:[
  {type:'Feature',geometry:{type:'Point',coordinates:[126.36,33.4]},
   properties:{kind:'gw',photos:arr}}]});
// 현장 파일명 예시 — 목장·구역·지점·MAC·날짜가 이름 자체에 들어 있다
const FNAME='색달목장_방목지_언덕2_D4F98D066F1D_260713.jpg';
t('사진 왕복: 내보내기→불러오기에서 보존', ()=>{
  const {back}=roundTrip({abc123:[{uri:JPG,name:FNAME},{uri:PNG}]});
  const got=back.out.pts[0].photos;         // realm 이 달라 deepStrictEqual 대신 값을 직접 본다
  assert.strictEqual(got.length,2);
  assert.strictEqual(got[0].uri,JPG);
  assert.strictEqual(got[1].uri,PNG);
  assert.strictEqual(back.log.length,0, '경고 '+JSON.stringify(back.log));
});
t('원본 파일명 왕복 (리사이즈로 EXIF 가 사라지므로 유일한 촬영 맥락)', ()=>{
  const {gj,back}=roundTrip({abc123:[{uri:JPG,name:FNAME}]});
  assert.strictEqual(gj.features[0].properties.photos[0].name, FNAME, '내보내기에 이름이 없다');
  assert.strictEqual(back.out.pts[0].photos[0].name, FNAME);
});
t('파일명 없는 사진은 키 자체가 안 나간다', ()=>{
  const {gj,back}=roundTrip({abc123:[{uri:JPG}]});
  assert.strictEqual('name' in gj.features[0].properties.photos[0], false);
  assert.strictEqual(back.out.pts[0].photos[0].name,'');
});
t('파일명 넣기 전 형식(문자열 배열)도 그대로 열린다', ()=>{
  const {out,log}=badPhotos([JPG,PNG]);     // 예전 내보내기 = data URI 문자열만
  assert.strictEqual(out.pts[0].photos.length,2);
  assert.strictEqual(out.pts[0].photos[0].uri,JPG);
  assert.strictEqual(out.pts[0].photos[0].name,'');
  assert.strictEqual(log.length,0, '경고 '+JSON.stringify(log));
});
t('파일명: 경로·제어문자 제거', ()=>{
  const {out}=badPhotos([{uri:JPG,name:'../../etc/pa\u0000ss\u001fwd.jpg'}]);
  assert.strictEqual(out.pts[0].photos[0].name,'passwd.jpg');
});
t('파일명: 120자 초과는 잘림', ()=>{
  const {out}=badPhotos([{uri:JPG,name:'가'.repeat(500)+'.jpg'}]);
  assert.strictEqual(out.pts[0].photos[0].name.length,120);
});
t('파일명이 문자열이 아니면 빈 값', ()=>{
  const {out}=badPhotos([{uri:JPG,name:{evil:1}},{uri:PNG,name:12345}]);
  assert.strictEqual(out.pts[0].photos[0].name,'');
  assert.strictEqual(out.pts[0].photos[1].name,'');
});
t('파일명의 스크립트는 이스케이프된다(팝업 title 로 들어간다)', ()=>{
  const {out}=badPhotos([{uri:JPG,name:'"><img src=x onerror=alert(1)>.jpg'}]);
  const n=out.pts[0].photos[0].name;
  const html=run('esc('+JSON.stringify(n)+')');
  assert.ok(html.indexOf('<img')===-1 && html.indexOf('"')===-1, html);
});
t('uri 없는 객체는 파일명이 있어도 버린다', ()=>{
  const {out,log}=badPhotos([{name:FNAME},{uri:'data:text/html;base64,AA==',name:FNAME}]);
  assert.strictEqual(out.pts[0].photos.length,0);
  assert.strictEqual(log.length,2);
});
t('지점 id(pid) 왕복: 사진을 잇는 열쇠라 살아야 한다', ()=>
  assert.strictEqual(roundTrip({}).back.out.pts[0].pid,'abc123'));
// 자동저장(localStorage)은 origin 당 약 5MB 고정이고 K 판과 나눠 쓴다.
// 여기 사진이 섞이면 QuotaExceededError 로 좌표까지 통째로 유실된다.
t('자동저장 GeoJSON 에는 사진이 안 들어간다', ()=>{
  const {gj}=roundTrip(undefined);          // saveLocal() 이 부르는 방식
  assert.strictEqual(gj.features[0].properties.photos, undefined);
  assert.ok(JSON.stringify(gj).indexOf('base64')<0);
});
t('사진 없는 기존 파일도 그대로 열린다(역호환)', ()=>{
  const {out,log}=ctx.parseGeoJSON(good);   // photos 키 자체가 없는 파일
  assert.strictEqual(out.pts.length,1);
  assert.strictEqual(out.pts[0].photos.length,0);
  assert.strictEqual(log.length,0, '경고 '+JSON.stringify(log));
});
t('사진이 붙은 K 파일도 그대로 열린다', ()=>{
  // K 가 내보낸 파일에는 pid·photos 가 같은 형식으로 들어 있다. 여기서 깨지면
  // 두 판이 사진을 주고받지 못한다 — 파일 하나로 오가는 구조의 핵심이다.
  const withPhoto=JSON.parse(JSON.stringify(fromK));
  withPhoto.properties.app='GeoMeasure K';
  withPhoto.features[0].properties.pid='kpid42';
  withPhoto.features[0].properties.photos=[{uri:JPG,name:FNAME}];
  const {out,log}=ctx.parseGeoJSON(withPhoto);
  assert.strictEqual(out.pts[0].pid,'kpid42');
  assert.strictEqual(out.pts[0].photos[0].uri,JPG);
  assert.strictEqual(out.pts[0].photos[0].name,FNAME);
  assert.strictEqual(log.length,0, '경고 '+JSON.stringify(log));
});
t('사진 모르는 구버전이 새 파일을 열어도 좌표는 산다', ()=>{
  // photos·pid 를 모르는 파서는 properties 를 무시할 뿐이다 — geometry 는 그대로여야 한다
  const {gj}=roundTrip({abc123:[JPG]});
  const c=gj.features[0].geometry.coordinates;
  assert.ok(c[0]===126.3664674 && c[1]===33.4011689, JSON.stringify(c));
});
t('data:text/html 은 거부 + 사유', ()=>{
  const {out,log}=badPhotos(['data:text/html;base64,PHNjcmlwdD4=']);
  assert.strictEqual(out.pts[0].photos.length,0);
  assert.ok(log.length>0, '버렸으면 사유를 남겨야 한다');
});
t('접두어 없는 문자열·javascript: 거부', ()=>{
  const {out}=badPhotos(['iVBORw0KGgo=', 'javascript:alert(1)', '<img src=x onerror=alert(1)>']);
  assert.strictEqual(out.pts[0].photos.length,0);
});
t('data URI 가 아닌 타입(객체·숫자) 거부', ()=>
  assert.strictEqual(badPhotos([{},7,null]).out.pts[0].photos.length,0));
t('photos 가 배열이 아니면 무시 + 사유', ()=>{
  const {out,log}=badPhotos(JPG);           // 단수 string 으로 온 경우
  assert.strictEqual(out.pts[0].photos.length,0);
  assert.ok(log.some(m=>m.includes('배열')));
});
t('한 장 2MB 초과 거부(DoS·용량 방어)', ()=>{
  const big='data:image/jpeg;base64,'+'A'.repeat(3*1024*1024);
  assert.strictEqual(badPhotos([big]).out.pts[0].photos.length,0);
});
t('장수 상한 20장', ()=>{
  const {out,log}=badPhotos(new Array(30).fill(JPG));
  assert.strictEqual(out.pts[0].photos.length,20);
  assert.ok(log.some(m=>m.includes('20장만')));
});
t('base64 문자셋 밖의 글자 거부', ()=>
  assert.strictEqual(badPhotos(['data:image/jpeg;base64,AAAA<>AAAA']).out.pts[0].photos.length,0));
t('okPhotoURI: 정상 3종 통과', ()=>{
  assert.ok(run('okPhotoURI('+JSON.stringify(JPG)+')'));
  assert.ok(run('okPhotoURI('+JSON.stringify(PNG)+')'));
  assert.ok(run('okPhotoURI("data:image/webp;base64,UklGRg==")'));
});
// 사진 DB 는 localStorage 키와 같은 이유로 K 와 달라야 한다 — IndexedDB 도 origin
// 단위라, 이름이 같으면 K 에서 지점을 지울 때 이쪽 사진까지 pid 로 같이 지워진다.
t('사진 IndexedDB 이름이 K 와 다르다(같은 호스트에서 DB 를 공유한다)', ()=>{
  assert.strictEqual(run('PDB_NAME'),'geomeasure-g-photos');
  assert.notStrictEqual(run('PDB_NAME'),'geomeasure-photos');
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

// ---- 8. '위성+' 오버줌 타일 좌표 ----
// 눈으로는 맞는지 알 수 없는 계산이다. 어긋나면 지도가 엉뚱한 자리를 그리거나
// 타일 경계가 어긋나 보이는데, 둘 다 "조금 이상한데" 로만 보여서 잡기 어렵다.
t('오버줌: 이미지가 있는 배율에서는 손대지 않는다', ()=>{
  const r=ctx.overzoomTile(446178, 210484, 19, 19);
  assert.strictEqual(r.z,19); assert.strictEqual(r.scale,1);
  assert.strictEqual(r.x,446178); assert.strictEqual(r.y,210484);
  assert.strictEqual(r.left,0); assert.strictEqual(r.top,0);
  assert.strictEqual(r.size,256);
});
t('오버줌: z21 요청 → z19 타일을 4배로 (용춘목장)', ()=>{
  // 용춘목장 A(33.4011689,126.3664674) 의 z21 타일 = (1784714,841939)
  const r=ctx.overzoomTile(1784714, 841939, 21, 19);
  assert.strictEqual(r.z,19);
  assert.strictEqual(r.scale,4);
  // 그 자리를 덮는 z19 타일은 실제 z19 좌표 (446178,210484) 여야 한다
  assert.strictEqual(r.x,446178);
  assert.strictEqual(r.y,210484);
  assert.strictEqual(r.size,1024);
});
t('오버줌: 잘라 보여줄 위치가 타일 안에 들어간다', ()=>{
  // left/top 은 음수(밀어내는 값)이고, 256px 창이 확대된 타일 밖으로 나가면 안 된다
  for(let dx=0; dx<4; dx++) for(let dy=0; dy<4; dy++){
    const r=ctx.overzoomTile(1784712+dx, 841936+dy, 21, 19);
    assert.ok(r.left<=0 && r.top<=0, 'left/top 은 0 이하여야 한다');
    assert.ok(-r.left+256<=r.size && -r.top+256<=r.size, '창이 타일 밖으로 나갔다');
  }
});
t('오버줌: 16칸이 모두 서로 다른 자리를 가리킨다', ()=>{
  // z19 타일 한 장이 z21 타일 16장을 덮는다 — 겹치면 같은 그림이 반복된다
  const seen=new Set();
  for(let dx=0; dx<4; dx++) for(let dy=0; dy<4; dy++){
    const r=ctx.overzoomTile(1784712+dx, 841936+dy, 21, 19);
    seen.add(r.left+','+r.top);
  }
  assert.strictEqual(seen.size,16);
});
t('오버줌: 지도 밖(극지방 너머)은 null', ()=>{
  assert.strictEqual(ctx.overzoomTile(0, -1, 19, 19), null);
  assert.strictEqual(ctx.overzoomTile(0, Math.pow(2,19), 19, 19), null);
});
t('오버줌: 날짜변경선을 넘어도 x 가 감긴다', ()=>{
  const n=Math.pow(2,19);
  assert.strictEqual(ctx.overzoomTile(n+5, 210484, 19, 19).x, 5);
});

// ---- 10. 자동저장: 복원 전에는 쓰지 않는다 ----
/* 2026-08-06 사고 재발 방지. initMap 이 중간에 끊겨 loadLocal() 이 안 돌았는데
   saveLocal() 은 그대로 돌아, 빈 상태가 저장된 작업을 덮어썼다. 화면으로는
   "검색이 안 된다"로만 보여서 데이터가 지워지는 걸 아무도 못 봤다.
   saveLocal 은 호출부가 16곳이라 잠금이 풀리면 조용히 다시 유실된다. */
t('자동저장: loadLocal 전에는 저장을 걸지 않는다', ()=>{
  run('saveTimer=null; localLoaded=false; saveLocal();');
  assert.strictEqual(run('saveTimer'), null, '복원 전에 저장 타이머가 걸렸다');
});
t('자동저장: loadLocal 뒤에는 저장이 걸린다', ()=>{
  // 저장된 게 없어도(getItem→null) 새 작업은 저장돼야 한다 — 기준은 "시도했다"
  run('saveTimer=null; localLoaded=false; loadLocal(); saveLocal();');
  assert.ok(run('saveTimer')!==null, '복원 뒤에도 저장이 안 걸린다');
  run('clearTimeout(saveTimer); saveTimer=null;');   // 테스트가 600 ms 매달리지 않게
});

// ---- 11. 영역 그리기 자체 구현 (구글 drawing 라이브러리 제거분) ----
/* 구글이 3.65 에서 DrawingManager 를 throw 로 바꿔 직접 구현으로 갈아탔다.
   손으로 쓴 상태기계(areaDraft/draftPoly/draftFirst)라 조용히 틀릴 수 있는 곳이
   생겼다 — 지도 렌더가 아니라 "꼭짓점이 어떻게 쌓이고 언제 영역이 되는가"만 본다. */
class FakeMapObj{                       // Marker·Polygon 자리를 채우는 최소 스텁
  constructor(o){ this.o=o||{}; this.path=(this.o.paths||[]).slice(); }
  setMap(){} setPath(p){ this.path=p.slice(); } addListener(ev,fn){ this[ev]=fn; }
}
ctx.google={maps:{Marker:FakeMapObj, Polygon:FakeMapObj}};
// addArea 는 오버레이·라벨까지 끌고 들어가므로 결과만 가로챈다
run('var captured=null; addArea=o=>{ captured=o; };');
const draft = expr => run('clearAreaDraft(); captured=null; '+expr);

t('영역: 꼭짓점 3개 미만이면 영역이 되지 않는다', ()=>{
  draft('addAreaVertex({lat:33.40,lng:126.36}); addAreaVertex({lat:33.40,lng:126.37}); closeAreaDraft();');
  assert.strictEqual(run('captured'), null, '2개짜리가 영역으로 들어갔다');
  // 취소하지 않고 그리던 상태를 유지해야 한다(첫 점을 두 번 누른 실수 대비)
  assert.strictEqual(run('areaDraft.length'), 2, '실패했다고 그리던 꼭짓점을 버렸다');
});
t('영역: 첫 꼭짓점 재클릭으로 닫으면 3개가 그대로 넘어간다', ()=>{
  draft('addAreaVertex({lat:33.40,lng:126.36}); addAreaVertex({lat:33.40,lng:126.37});'
       +'addAreaVertex({lat:33.41,lng:126.37}); closeAreaDraft();');
  assert.strictEqual(run('captured.path.length'), 3);
  eqPt(run('captured.path[0]'), 33.40, 126.36);
  assert.ok(ctx.polyArea(run('captured.path'))>0, '면적이 0이면 좌표가 뒤바뀐 것');
});
t('영역: 닫고 나면 다음 영역이 이어 붙지 않는다', ()=>{
  // clearAreaDraft 를 addArea 앞으로 옮기면 path 가 빈 채로 넘어간다 — 순서가 곧 버그다
  draft('addAreaVertex({lat:33.40,lng:126.36}); addAreaVertex({lat:33.40,lng:126.37});'
       +'addAreaVertex({lat:33.41,lng:126.37}); closeAreaDraft();');
  assert.strictEqual(run('areaDraft.length'), 0);
  assert.strictEqual(run('draftFirst'), null, '첫 꼭짓점 마커가 남아 다음 영역을 오염시킨다');
});
t('영역: 첫 꼭짓점 마커는 하나만 생긴다(닫기 대상이 흔들리지 않게)', ()=>{
  draft('addAreaVertex({lat:33.40,lng:126.36});');
  const first=run('draftFirst');
  run('addAreaVertex({lat:33.41,lng:126.37});');
  assert.strictEqual(run('draftFirst'), first);
});
t('영역: 범위 밖 좌표는 normPath 가 걸러 영역이 되지 않는다', ()=>{
  draft('addAreaVertex({lat:999,lng:999}); addAreaVertex({lat:33.40,lng:126.37});'
       +'addAreaVertex({lat:33.41,lng:126.37}); closeAreaDraft();');
  assert.strictEqual(run('captured'), null);
});

// ---- 9. 드라이브 링크에서 파일 ID 뽑기 ----
// 붙여넣는 형태가 제각각이라 여기가 조용히 틀리면 "링크 형식을 확인하세요"만 뜬다.
// ID 를 못 뽑으면 요청 자체가 안 나가므로, 형태별로 한 줄씩 남긴다.
const ID='1A2b3C4d5E6f7G8h9I0jKlMnOpQrStUv';
t('driveFileId: 공유 버튼 링크(/file/d/…/view)', ()=>
  assert.strictEqual(ctx.driveFileId('https://drive.google.com/file/d/'+ID+'/view?usp=sharing'),ID));
t('driveFileId: /open?id= 형태', ()=>
  assert.strictEqual(ctx.driveFileId('https://drive.google.com/open?id='+ID),ID));
t('driveFileId: uc?export=download&id= 형태', ()=>
  assert.strictEqual(ctx.driveFileId('https://drive.google.com/uc?export=download&id='+ID),ID));
t('driveFileId: ID 만 붙여넣어도 받는다', ()=>
  assert.strictEqual(ctx.driveFileId('  '+ID+'  '),ID));
// 임의 URL 을 그대로 fetch 하지 않는다는 보장이 이 두 줄이다(요청처는 googleapis.com 고정).
t('driveFileId: 관계없는 URL 은 null', ()=>
  assert.strictEqual(ctx.driveFileId('https://example.com/evil.geojson'),null));
t('driveFileId: 빈 값·undefined 는 null', ()=>{
  assert.strictEqual(ctx.driveFileId(''),null);
  assert.strictEqual(ctx.driveFileId(undefined),null);
});

// ---- 10. 공유 주소 조합 ----
// 여기가 조용히 틀리면 링크를 받은 쪽에서만 실패한다 — 만든 사람은 끝까지 모른다.
const withInput = (val,fn)=>{
  const box={value:val}, orig=ctx.document.getElementById;
  ctx.document.getElementById=()=>box;
  try{ return fn(); } finally { ctx.document.getElementById=orig; }
};
ctx.location.origin='https://yepark.co.kr';
ctx.location.pathname='/bovicare-gmapgoogle/';
t('gdShareURL: 현재 주소 + ?gd=<파일 ID>', ()=>
  assert.strictEqual(
    withInput('https://drive.google.com/file/d/'+ID+'/view?usp=sharing', ctx.gdShareURL),
    'https://yepark.co.kr/bovicare-gmapgoogle/?gd='+ID));
// 링크 통째가 아니라 ID 를 넣는 게 의도다(URL 안에 URL 이 들어가면 두 배로 길어진다).
t('gdShareURL: 링크가 아니라 ID 가 들어간다', ()=>
  assert.ok(!withInput('https://drive.google.com/file/d/'+ID+'/view', ctx.gdShareURL).includes('drive.google.com')));
t('gdShareURL: 유효한 링크가 아니면 빈 문자열(버튼을 숨기는 조건)', ()=>{
  assert.strictEqual(withInput('', ctx.gdShareURL),'');
  assert.strictEqual(withInput('https://example.com/x', ctx.gdShareURL),'');
});
/* dev 사본에서 만든 링크는 dev 주소가 나와야 한다. 경로를 박아 두면 dev 에서 만든
   링크가 라이브를 가리켜, 아직 검증 안 된 파일이 서비스 화면에 열린다(§3.4). */
t('gdShareURL: -dev 에서 만들면 dev 주소가 나온다', ()=>{
  ctx.location.pathname='/bovicare-gmapgoogle-dev/';
  assert.strictEqual(withInput(ID, ctx.gdShareURL),
    'https://yepark.co.kr/bovicare-gmapgoogle-dev/?gd='+ID);
});

// ---- 11. 마커 이름 라벨: 그림이 커져도 좌표는 안 움직여야 한다 ----
// 이름 폭이 어림값이라 크기 계산이 조용히 틀어질 수 있다. 틀어지면 마커가
// 좌표에서 밀리는데(= 측정 결과가 거짓말이 된다) 화면으로는 알아채기 어렵다.
ctx.google={maps:{
  Size:class{ constructor(w,h){ this.w=w; this.h=h; } },
  Point:class{ constructor(x,y){ this.x=x; this.y=y; } },
  SymbolPath:{CIRCLE:'circle'}}};
const icon = (name,hasPhoto)=>ctx.markerIcon('#ff0000',!!hasPhoto,name);
/* G 는 이름도 배지도 없으면 SVG 로 안 내려간다(SymbolPath 한 줄). K 는 글자를
   그려야 해서 항상 SVG 였다 — 대응표의 그 차이가 여기서 눈에 보인다. */
t('이름·배지가 없으면 SVG 로 안 내려간다(기본 경로 유지)', ()=>{
  const a=icon('');
  assert.strictEqual(a.path,'circle');
  assert.strictEqual(a.url, undefined);
});
t('배지만 있으면 그림 크기가 예전 그대로', ()=>{
  const b=icon('',true);
  assert.deepStrictEqual([b.scaledSize.w,b.scaledSize.h,b.anchor.x,b.anchor.y],[36,36,14,22]);
});
t('이름이 길어도 anchor 는 계속 원의 중심', ()=>{
  ['가','본관 게이트웨이','WWWWWWWWWW'].forEach(n=>{
    [false,true].forEach(hp=>{
      const im=icon(n,hp), r=12+1;                    // 원 반지름 + 흰 테두리
      assert.ok(im.anchor.y===(hp?22:14), n+' y');
      assert.ok(im.anchor.x>=r && im.anchor.x+r<=im.scaledSize.w, n+' x='+im.anchor.x+' w='+im.scaledSize.w);
    });
  });
});
// labelOrigin 이 anchor 와 어긋나면 A·B·C 가 원 밖에 찍힌다(G 만의 실패 모드 —
// K 는 글자가 SVG 안에 있어 어긋날 자리가 없다).
t('labelOrigin 은 anchor 와 같은 자리(글자가 원 안에 남는다)', ()=>{
  ['','가나다라마바사아자차'].forEach(n=>[false,true].forEach(hp=>{
    const im=icon(n,hp);
    if(!im.url) return;                              // SymbolPath 경로엔 labelOrigin 이 없다
    assert.deepStrictEqual([im.labelOrigin.x,im.labelOrigin.y],[im.anchor.x,im.anchor.y], n);
  }));
});
t('이름이 그림 밖으로 안 나간다', ()=>{
  ['가나다라마바사아자차','Gateway-01'].forEach(n=>{
    const im=icon(n), half=run('nameWidth('+JSON.stringify(n)+')')/2;
    assert.ok(im.anchor.x-half>=0 && im.anchor.x+half<=im.scaledSize.w, n+' 폭 초과');
    assert.ok(im.scaledSize.h>28, n+' 높이가 안 늘었다');
  });
});
// 이름은 사용자·파일에서 온다 — SVG 안에 그대로 들어가면 그림이 통째로 깨진다.
t('이름 이스케이프', ()=>{
  const svg=decodeURIComponent(icon('<b>&"x').url.split(',')[1]);
  assert.ok(!svg.includes('<b>') && svg.includes('&lt;b&gt;'), svg.slice(-160));
});

// ---- 12. 지점 순서 바꾸기 ----
// 순서는 표시가 아니라 계산이다(구간 거리·폐합 둘레가 배열 순서로 나온다).
// 원소를 통째로 옮기지 않으면 이름·사진(pid)이 엉뚱한 지점에 가서 붙는다.
const moved = (arr,i,j)=>{ const a=arr.slice(); run('moveItem')(a,i,j); return a; };
t('moveItem: 한 칸 위로 (F→E 자리)', ()=>
  assert.deepStrictEqual(moved(['A','B','C'],2,1), ['A','C','B']));
t('moveItem: 한 칸 아래로', ()=>
  assert.deepStrictEqual(moved(['A','B','C'],0,1), ['B','A','C']));
t('moveItem: 두 칸 이상도 자리 그대로', ()=>
  assert.deepStrictEqual(moved(['A','B','C','D'],3,1), ['A','D','B','C']));
t('moveItem: 이름·사진이 지점을 따라간다', ()=>{
  const a=moved([{name:'가',pid:'p1'},{name:'나',pid:'p2'},{name:'다',pid:'p3'}],2,0);
  assert.deepStrictEqual(a.map(p=>p.name+':'+p.pid), ['다:p3','가:p1','나:p2']);
});

console.log('\n'+(fail?('실패 '+fail+'건 / '):'')+'통과 '+pass+'건');
process.exit(fail?1:0);
