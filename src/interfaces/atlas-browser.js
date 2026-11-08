(() => {
  'use strict';
  const en=document.documentElement.lang==='en';
  const t=(ar,english)=>en?english:ar;
  const form=document.querySelector('#atlas-search');
  const status=document.querySelector('#search-status');
  const results=document.querySelector('#results');
  const mode=document.querySelector('#mode');
  const governorate=document.querySelector('#governorate');
  const button=form.querySelector('button');
  const syncScope=()=>{governorate.disabled=mode.value!=='services';document.querySelector('#governorate-field').classList.toggle('disabled',governorate.disabled);};
  mode.addEventListener('change',syncScope);syncScope();
  let active;
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!form.reportValidity())return;
    active?.abort();const controller=new AbortController();active=controller;
    const url=new URL(form.action);url.search=new URLSearchParams(new FormData(form)).toString();
    status.textContent=t('نبحث في المصدر…','Searching the source…');status.classList.remove('error');
    results.setAttribute('aria-busy','true');results.classList.add('busy');button.disabled=true;
    try {
      const response=await fetch(url.pathname+url.search,{signal:controller.signal,headers:{'Accept':'text/html'}});
      if(!response.ok)throw new Error('source_unavailable');
      const documentResult=new DOMParser().parseFromString(await response.text(),'text/html');
      const source=documentResult.querySelector('#results');const message=documentResult.querySelector('#search-status');
      if(!source||!message)throw new Error('invalid_response');
      results.replaceChildren(...Array.from(source.childNodes));status.textContent=message.textContent;
      if(documentResult.querySelector('[data-search-error]'))status.classList.add('error');
      history.replaceState(null,'',url.pathname+url.search+'#search');
    } catch(error) {
      if(error.name!=='AbortError'){status.textContent=t('تعذّر الاتصال بالمصدر. أعد المحاولة بعد قليل.','Could not connect to the source. Please try again shortly.');status.classList.add('error');results.replaceChildren();}
    } finally {if(active===controller){results.setAttribute('aria-busy','false');results.classList.remove('busy');button.disabled=false;}}
  });
  document.querySelectorAll('[data-query]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();document.querySelector('#query').value=link.dataset.query;form.requestSubmit();}));
  const names=en?{service:'services',organization:'organizations',legal:'legal references',indicator:'indicators',dataset:'datasets'}:{service:'خدمات',organization:'جهات',legal:'مراجع قانونية',indicator:'مؤشرات',dataset:'مجموعات بيانات'};
  fetch('/api/v1/coverage',{headers:{Accept:'application/json'}}).then(response=>{if(!response.ok)throw new Error('coverage_unavailable');return response.json();}).then(data=>{
    if(!Number.isFinite(data.records)||!data.byType)throw new Error('invalid_coverage');
    document.querySelector('#coverage-total').textContent=String(data.records);window.__atlasCount?.(document.querySelector('#coverage-total'),data.records);
    const list=document.querySelector('#coverage-types');list.replaceChildren();
    Object.entries(data.byType).forEach(([type,count])=>{const span=document.createElement('span');const label=en&&type==='dataset'&&count===1?'dataset':!en&&type==='dataset'&&count===1?'مجموعة بيانات':!en&&type==='service'&&count>10?'خدمة':names[type]||type;span.textContent=`${count} ${label}`;list.append(span);});
    document.querySelector('#coverage-date').textContent=data.lastUpdated?t('أحدث تحقق مسجل: ','Most recent recorded verification: ')+data.lastUpdated:t('لا يتوفر تاريخ تحقق. افحص كل سجل.','Verification date unavailable. Inspect each record.');
  }).catch(()=>{document.querySelector('#coverage-types').textContent=t('أعداد السجلات غير متاحة الآن. أعد تحميل الصفحة للمحاولة.','Record counts unavailable. Reload the page to retry.');});
})();

// Identity 2026 motion: count-up, scroll reveals, staggered results. Off under reduced motion.
(() => {
  'use strict';
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce)return;
  document.documentElement.classList.add('motion-ok');
  window.__atlasCount=(el,to)=>{const start=performance.now(),d=1000;const step=t=>{const k=Math.min(1,(t-start)/d);el.textContent=String(Math.round(to*(1-Math.pow(1-k,3))));if(k<1)requestAnimationFrame(step);};requestAnimationFrame(step);};
  const io='IntersectionObserver' in window?new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-in');io.unobserve(e.target);}}),{rootMargin:'0px 0px -8% 0px',threshold:.08}):null;
  const watch=root=>root.querySelectorAll('.section-heading,.result,.method li,.about>*,.developers>*,.endpoints>*').forEach((el,i)=>{if(el.classList.contains('reveal'))return;el.classList.add('reveal');el.style.setProperty('--d',(i%6)*60+'ms');io?io.observe(el):el.classList.add('is-in');});
  watch(document);
  const results=document.querySelector('#results');
  if(results)new MutationObserver(()=>watch(results)).observe(results,{childList:true});
})();
