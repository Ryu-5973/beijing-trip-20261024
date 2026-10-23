(() => {
"use strict";
const T=window.TRIP, $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const mapUrl=q=>"https://api.map.baidu.com/place/search?query="+encodeURIComponent(q)+"&region="+encodeURIComponent("北京")+"&output=html&src=webapp.beijingtrip.guide";
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem("bjtrip-"+key))??fallback}catch{return fallback}};
const save=(key,value)=>{try{localStorage.setItem("bjtrip-"+key,JSON.stringify(value));return true}catch{return false}};
const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
let day=T.days.find(d=>d.date===today)?.id||1, meal="d1d", view="itinerary", food=null;
let choices=read("choices",{}), checklist=read("checklist",{}), weather=read("weather",null)||T.weather, weatherMessage="", toastTimer;
function toast(text){$("#toast").textContent=text;$("#toast").classList.add("visible");clearTimeout(toastTimer);toastTimer=setTimeout(()=>$("#toast").classList.remove("visible"),2600)}
function switchView(name,scroll=true){view=name;$$(".view").forEach(e=>e.hidden=e.id!=="view-"+name);$$("[data-view]").forEach(b=>{b.classList.toggle("active",b.dataset.view===name);b.setAttribute("aria-current",b.dataset.view===name?"page":"false")});if(scroll)window.scrollTo({top:0,behavior:"instant"});history.replaceState(null,"","#"+(name==="itinerary"?"day"+day:name));}
function symbol(code){if(code===0)return"☀";if(code===1||code===2)return"🌤";if(code===3)return"☁";if([45,48].includes(code))return"🌫";if([71,73,75,77,85,86].includes(code))return"❄";if(code>=95)return"⛈";return"☂"}
function condition(code){if(code===0)return"晴";if(code===1)return"晴间多云";if(code===2)return"多云";if(code===3)return"阴";if([45,48].includes(code))return"有雾";if([51,53,55].includes(code))return"毛毛雨";if([56,57,66,67].includes(code))return"冻雨";if([61,63,65].includes(code))return"有雨";if([71,73,75,77,85,86].includes(code))return"有雪";if(code>=95)return"雷雨";if([80,81,82].includes(code))return"阵雨";return"天气变化"}
const fmtTime=s=>{try{return new Intl.DateTimeFormat("zh-CN",{timeZone:"Asia/Shanghai",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(s))}catch{return s}};
function weatherDay(date){const w=weather?.daily,i=w?.time?.indexOf(date);if(i===undefined||i<0)return null;return{code:w.weather_code[i],max:Math.round(w.temperature_2m_max[i]),min:Math.round(w.temperature_2m_min[i]),rain:w.precipitation_probability_max?.[i]}}
function renderWeather(){
 const date=T.days[day-1].date,w=weatherDay(date),update=fmtTime(weather.updatedAt);
 $("#day-weather").innerHTML=w?'<span class="weather-symbol" aria-hidden="true">'+symbol(w.code)+'</span><div><strong>'+esc(condition(w.code))+'　'+w.min+'–'+w.max+'℃</strong><div class="fine">最低–最高'+(Number.isFinite(w.rain)?' · 降水 '+w.rain+'%':'')+'</div></div><span class="weather-meta">'+esc(weather.source)+'<br>'+esc(update)+'</span>':'天气暂不可用，请查看随身页的官方预报链接。';
 $("#weather-days").innerHTML=T.days.map(d=>{const x=weatherDay(d.date);return '<div class="weather-day"><b>'+d.short+' '+d.weekday+'</b>'+(x?'<span class="symbol" aria-hidden="true">'+symbol(x.code)+'</span><span>'+esc(condition(x.code))+'</span><strong>'+x.max+'° <span class="low">/ '+x.min+'°</span></strong><span>最高 / 最低</span><div class="rain">降水概率 '+(Number.isFinite(x.rain)?x.rain+"%":"暂无")+'</div>':'<p>暂无该日预报</p>')+'</div>'}).join("");
 $("#weather-status").textContent=weatherMessage||weather.source+" · "+update+" 获取 · "+weather.kind;
 const c=weather.current;$("#current-weather").textContent=c?"最近时次 "+c.time.replace("T"," ")+"：气温 "+c.temperature_2m+"℃，体感 "+c.apparent_temperature+"℃。":"";
}
async function refreshWeather(){
 const b=$("#refresh-weather");b.disabled=true;weatherMessage="正在获取北京预报，现有内容仍可查看。";renderWeather();
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
 try{
 const u=new URL("https://api.open-meteo.com/v1/forecast");
 Object.entries({latitude:"39.9042",longitude:"116.4074",daily:"weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",current:"temperature_2m,apparent_temperature,weather_code",timezone:"Asia/Shanghai",start_date:"2026-10-24",end_date:"2026-10-26"}).forEach(([k,v])=>u.searchParams.set(k,v));
 const response=await fetch(u,{signal:controller.signal,cache:"no-store"});if(!response.ok)throw new Error("weather HTTP "+response.status);
 const json=await response.json();if(!json.daily||!T.days.every(d=>{const i=json.daily.time?.indexOf(d.date);return i>=0&&Number.isFinite(json.daily.temperature_2m_max?.[i])&&Number.isFinite(json.daily.temperature_2m_min?.[i])&&Number.isFinite(json.daily.weather_code?.[i])}))throw new Error("weather incomplete");
 weather={updatedAt:new Date().toISOString(),source:"Open-Meteo",kind:"已联网更新",daily:json.daily,current:json.current};save("weather",weather);weatherMessage="";
 }catch(e){weatherMessage="本次刷新未成功，保留 "+fmtTime(weather.updatedAt)+" 获取的预报。可重试或查看中国天气网。"}
 finally{clearTimeout(timeout);b.disabled=false;renderWeather()}
}
function transferHTML(t){if(!t)return"";const modes=[["car","车"],["metro","铁"],["walk","步"],["bus","公交"]].filter(([k])=>t[k]).map(([k,l])=>'<span class="mode">'+l+' <b>'+esc(t[k])+'</b></span>').join("");return '<div class="transfer"><div class="destination">前往'+esc(t.to)+'</div><div class="distance">'+esc(t.distance)+'</div><div class="modes">'+modes+'</div><details class="plain-details"><summary>换乘与计时说明</summary><p>'+esc(t.detail)+'</p></details></div>'}
function mealChoice(id){const x=food?.core.find(r=>r.id===choices[id]);return x?x.name:null}
function eventHTML(e,i){return '<article class="event"><div class="event-time">'+esc(e.time)+'</div><div class="event-head"><div><h3>'+esc(e.title)+'</h3>'+(e.tag?'<span class="tag">'+esc(e.tag)+'</span>':'')+'</div>'+(e.map?'<a class="map-link" href="'+mapUrl(e.map)+'" target="_blank" rel="noopener" aria-label="在地图查看'+esc(e.map)+'">地图 ↗</a>':'')+'</div><p class="event-desc">'+esc(e.desc)+'</p>'+(e.detail?'<details class="plain-details"><summary>查看提醒'+(e.source?'与来源':'')+'</summary><p>'+esc(e.detail)+'</p>'+(e.source?'<p><a href="'+esc(e.source)+'" target="_blank" rel="noopener">官方说明 ↗</a></p>':'')+'</details>':'')+(e.meal?'<button class="meal-button" data-meal-link="'+e.meal+'"><b>'+(mealChoice(e.meal)?'已选：'+esc(mealChoice(e.meal)):'挑选这一餐')+'</b><span>查看备选 ›</span></button>':'')+transferHTML(e.transport)+'</article>'}
function renderDay(){
 const d=T.days[day-1];$("#day-tabs").innerHTML=T.days.map(x=>'<button class="day-tab '+(x.id===day?"active":"")+'" role="tab" aria-selected="'+(x.id===day)+'" tabindex="'+(x.id===day?0:-1)+'" data-day="'+x.id+'"><strong>'+x.short+'</strong>'+x.weekday+'<small>'+["天坛 · 天安门 · 前门","北海 · 王府 · 胡同","清北 · 地坛 · 返程"][x.id-1]+'</small></button>').join("");
 $("#day-heading").innerHTML='<h2>'+esc(d.title)+'</h2><p class="route">'+esc(d.route)+'</p><p class="day-tip">'+esc(d.note)+'</p><p class="rain-tip">☂ '+esc(d.rain)+'</p>';
 $("#timeline").innerHTML=d.events.map(eventHTML).join("");renderWeather();
}
function ratingText(r){if(r.id==="D3A")return"本店页面混有其他分店点评，不列评分；本店评价证据较弱。";return r.rating}
function mealHTML(m){
 const selected=choices[m.id];return '<div class="meal-intro"><h2>'+esc(m.title)+' <small>'+esc(m.time)+'</small></h2><p>'+esc(m.desc)+'</p></div>'+m.ids.map((id,index)=>{const r=food.core.find(x=>x.id===id);return '<article class="restaurant '+(selected===id?"chosen":"")+'"><div class="restaurant-top"><h3>'+esc(r.name)+'</h3><div class="budget">¥'+esc(r.budget)+'<small>两人合计预留</small></div></div><p class="restaurant-address">'+esc(r.address)+'</p><div class="rating">'+esc(ratingText(r))+'</div><div class="review-lines"><p><b>好评</b>'+esc(r.positive)+'</p><p class="caution"><b>留意</b>'+esc(r.caution)+'</p><p><b>安排</b>'+esc(r.judgment)+'</p></div><p class="order"><b>可以这样点：</b>'+esc(r.order)+'</p><div class="button-row"><button class="choose-button" data-choice="'+esc(id)+'" data-meal="'+esc(m.id)+'" aria-pressed="'+(selected===id)+'">'+(selected===id?'✓ 这顿已选 · 再点取消':'这顿选它')+'</button><a class="map-link" href="'+mapUrl(r.name)+'" target="_blank" rel="noopener">地图 ↗</a><a class="review-link" href="'+esc(r.source)+'" target="_blank" rel="noopener">原始评价 ↗</a></div></article>'}).join("");
}
function renderMeal(){
 $("#meal-tabs").innerHTML=T.meals.map(m=>'<button class="chip '+(m.id===meal?"active":"")+'" role="tab" aria-selected="'+(m.id===meal)+'" tabindex="'+(m.id===meal?0:-1)+'" data-meal-tab="'+m.id+'">第'+m.day+'天 '+(m.id.endsWith("l")?"午餐":"晚餐")+(choices[m.id]?" ✓":"")+'</button>').join("");
 if(!food){$("#meal-content").innerHTML='<p>正在读取餐厅评价…</p>';return}
 $("#meal-content").innerHTML=mealHTML(T.meals.find(m=>m.id===meal));
}
function renderExtras(){
 const groups=[["早餐",[0,1]],["顺路小吃",[2,3,4,5,6]],["机场餐",[7,8,9]]];
 $("#extra-food").innerHTML=groups.map(([name,ids])=>'<div class="extra-group" id="extra-'+(name==="早餐"?"breakfast":name==="机场餐"?"airport":"snacks")+'"><h3>'+name+'</h3>'+ids.filter(i=>food.auxiliary[i]).map(i=>{const x=food.auxiliary[i];return '<details class="extra-food"><summary>'+esc(x.name)+' <span class="fine"> · '+esc(x.type)+'</span></summary><p>'+esc(x.summary)+'</p><p><a href="'+esc(x.source)+'" target="_blank" rel="noopener">来源与评价 ↗</a></p></details>'}).join("")+'</div>').join("");
 $("#review-method").textContent=food.method;
}
function renderChecklist(){const items=["身份证、机票与酒店订单","恭王府10/25门票时段已确认","天坛门票 / 联票已核对","若进天安门广场，已完成预约","充电宝、充电线、足够手机电量","折叠伞、防风外套、舒适鞋","第三天退房寄存，记好取行李处","MU5190起飞时间已按订单核对"];$("#checklist").innerHTML=items.map((t,i)=>'<label class="check-item"><input type="checkbox" data-check="'+i+'" '+(checklist[i]?"checked":"")+'><span>'+esc(t)+'</span></label>').join("")}
async function copy(text){try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text)}else{const el=document.createElement("textarea");el.value=text;el.style.position="fixed";el.style.top="-9999px";document.body.append(el);el.select();if(!document.execCommand("copy"))throw new Error("copy failed");el.remove()}toast("已复制")}catch{toast("复制未成功，请长按文字或复制地址栏。")}}
document.addEventListener("click",e=>{
 const viewBtn=e.target.closest("[data-view]");if(viewBtn){switchView(viewBtn.dataset.view);return}
 const dayBtn=e.target.closest("[data-day]");if(dayBtn){day=Number(dayBtn.dataset.day);renderDay();history.replaceState(null,"","#day"+day);return}
 const tab=e.target.closest("[data-meal-tab]");if(tab){meal=tab.dataset.mealTab;renderMeal();return}
 const link=e.target.closest("[data-meal-link]");if(link){if(["breakfast","airport"].includes(link.dataset.mealLink)){switchView("food");requestAnimationFrame(()=>$("#extra-"+link.dataset.mealLink)?.scrollIntoView({block:"start"}))}else{meal=link.dataset.mealLink;renderMeal();switchView("food")}return}
 const choice=e.target.closest("[data-choice]");if(choice){const m=choice.dataset.meal,id=choice.dataset.choice;if(choices[m]===id){delete choices[m];toast("已取消这一餐的选择")}else{choices[m]=id;toast("已记下这一餐，未向餐厅下单")}if(!save("choices",choices))toast("当前浏览器无法保存，离开页面后可能丢失。");renderMeal();renderDay();}
});
document.addEventListener("keydown",e=>{if(!["ArrowLeft","ArrowRight"].includes(e.key))return;const tab=e.target.closest('[role="tab"]');if(!tab)return;e.preventDefault();const tabs=Array.from(tab.parentElement.querySelectorAll('[role="tab"]')),i=tabs.indexOf(tab),n=(i+(e.key==="ArrowRight"?1:-1)+tabs.length)%tabs.length;tabs[n].click();const selector=tabs[n].hasAttribute("data-day")?'[data-day="'+tabs[n].dataset.day+'"]':'[data-meal-tab="'+tabs[n].dataset.mealTab+'"]';$(selector)?.focus()});
document.addEventListener("change",e=>{if(e.target.matches("[data-check]")){checklist[e.target.dataset.check]=e.target.checked;save("checklist",checklist)}});
$("#weather-jump").addEventListener("click",()=>switchView("kit"));
$("#refresh-weather").addEventListener("click",refreshWeather);
$("#hotel-map").href=mapUrl(T.hotel.map);
$("#copy-hotel").addEventListener("click",()=>copy(T.hotel.name+"，"+T.hotel.address));
$("#flight-note").value=read("flight-note","");
$("#flight-note").addEventListener("input",e=>save("flight-note",e.target.value));
$("#flight-note").addEventListener("change",()=>toast("机票备注已保存在本机"));
$("#share-page").addEventListener("click",async()=>{try{if(navigator.share){await navigator.share({title:"北京三日 · 随身旅行手册",url:location.href})}else{await copy(location.href)}}catch(e){if(e.name!=="AbortError")copy(location.href)}});
$("#print-page").addEventListener("click",()=>window.print());
window.addEventListener("beforeprint",()=>{$("#day-heading").innerHTML="<h2>完整三日行程</h2>";$("#timeline").innerHTML=T.days.map(d=>'<h2 style="margin:25px 0">'+d.short+" "+d.title+'</h2>'+d.events.map(eventHTML).join("")).join("");if(food)$("#meal-content").innerHTML=T.meals.map(mealHTML).join("")});
window.addEventListener("afterprint",()=>{renderDay();renderMeal()});
const hash=location.hash.slice(1);if(/^day[123]$/.test(hash))day=Number(hash.at(-1));else if(["food","kit"].includes(hash))view=hash;
renderDay();renderMeal();renderChecklist();switchView(view,false);
fetch("./food-data.json").then(r=>{if(!r.ok)throw new Error("data");return r.json()}).then(d=>{food=d;renderMeal();renderExtras();renderDay()}).catch(()=>{$("#meal-content").innerHTML='<p>餐厅文字未能加载。请刷新重试，或先看 <a href="./assets/food-map.png">美食长图</a> 与 <a href="./assets/food-reviews.txt">完整评价笔记</a>。</p>'});
refreshWeather();
if("serviceWorker" in navigator){navigator.serviceWorker.register("./sw.js").then(()=>navigator.serviceWorker.ready).then(()=>{$("#offline-status").textContent="文字资料已准备离线使用。图片首次打开后才会缓存；地图、天气刷新与原始评价需要联网。"}).catch(()=>{$("#offline-status").textContent="当前浏览器未启用离线保存，请收藏网址并下载两张攻略图备用。"})}else{$("#offline-status").textContent="当前浏览器不支持离线保存，建议收藏网址并下载攻略图。"}
})();