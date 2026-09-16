'use strict';
const $ = id => document.getElementById(id);
const labels = {planned:'待实现', in_progress:'进行中', done:'已完成', skipped:'已跳过'};
const el = (tag, cls, text) => {const node=document.createElement(tag); if(cls) node.className=cls; if(text!==undefined) node.textContent=text; return node;};
let data;
const currentStatus = f => f.scope_status==='skipped' ? 'skipped' : f.status;
const currentScope = features => features.filter(f=>currentStatus(f)!=='skipped');
function validateFeatures(features) {
  for(const f of features) {
    const scope=f.scope_status===undefined?'active':f.scope_status;
    if(!['active','skipped'].includes(scope) || (scope==='skipped' && (typeof f.scope_reason!=='string'||!f.scope_reason.trim())) ||
       !['planned','in_progress','done','skipped'].includes(f.status) || (scope!=='skipped' && f.status==='skipped') || !Array.isArray(f.history)) throw new Error('无效功能状态');
  }
}
function link(text,url) {const a=el('a','',text); a.href=url; a.target='_blank'; a.rel='noopener noreferrer'; return a;}
function render() {
  const query=$('search').value.trim().toLocaleLowerCase(); const stage=$('stage').value; const status=$('status').value;
  const root=$('stages'); root.replaceChildren(); let visible=0;
  for(const s of data.stages) {
    if(stage!=='all' && s.id!==stage) continue;
    const selected=s.features.filter(f=>(status==='all'||currentStatus(f)===status)&&`${f.id} ${f.title} ${f.acceptance} ${f.scope_reason||''}`.toLocaleLowerCase().includes(query));
    if(!selected.length) continue;
    visible+=selected.length;
    const section=el('section','stage'); const head=el('div','stage-head'); const title=el('div','stage-title');
    title.append(el('span','stage-id',s.id),el('h3','',s.title)); const scoped=currentScope(s.features);const skipped=s.features.length-scoped.length;head.append(title,el('span','stage-count',`${scoped.filter(f=>currentStatus(f)==='done').length} / ${scoped.length} 已完成${skipped?` · 已跳过 ${skipped} 项`:''}`));section.append(head);
    for(const f of selected) {
      const row=el('details','feature'); row.id=f.id; const summary=el('summary');summary.append(el('span','feature-id',f.id),el('span','feature-title',f.title),el('span',`badge ${currentStatus(f)}`,labels[currentStatus(f)]),el('span','chevron','›'));row.append(summary);
      const detail=el('div','detail');detail.append(el('p','',f.acceptance));if(currentStatus(f)==='skipped') detail.append(el('p','scope-reason',`${f.scope_reason} 已跳过不等于已完成，不计入完成率；下列历史记录仅保留追溯。`));
      if(!f.history.length) detail.append(el('p','', '尚无关联的合并记录。'));
      else {const list=el('ul');for(const h of [...f.history].reverse()) {const item=el('li');item.append(document.createTextNode(`${h.merged_at.slice(0,10)} · ${labels[h.status]} · `),link(`PR #${h.pr}`,`https://github.com/${data.repository}/pull/${h.pr}`));for(const evidence of h.evidence){item.append(document.createTextNode(' · '),link('验收记录',`https://github.com/${data.repository}/blob/${h.sha}/${evidence}`));}list.append(item);}detail.append(list);}
      row.append(detail);section.append(row);
    } root.append(section);
  }
  $('count').textContent=`显示 ${visible} 项`;
  if(!visible) root.append(el('p','empty','没有匹配的功能，请调整筛选条件。'));
}
async function init(){
 try {
  const response=await fetch('./data.json',{cache:'no-cache'});if(!response.ok) throw new Error('加载失败');data=await response.json();
  const features=data.stages.flatMap(s=>s.features);validateFeatures(features);const scoped=currentScope(features);const done=scoped.filter(f=>currentStatus(f)==='done').length;const percent=scoped.length?Math.round(done/scoped.length*100):0;
  $('total').textContent=scoped.length;$('skipped').textContent=features.length-scoped.length;$('done').textContent=done;$('active').textContent=scoped.filter(f=>currentStatus(f)==='in_progress').length;$('percent').textContent=`${percent}%`;$('progress').style.width=`${percent}%`;$('scope').textContent=data.scope_note;
  for(const s of data.stages){const option=el('option','',`${s.id} · ${s.title}`);option.value=s.id;$('stage').append(option);}
  $('updated').textContent=`更新于 ${new Date(data.generated_at).toLocaleString('zh-CN',{hour12:false})}`;$('revision').textContent=`SOURCE ${data.source_sha.slice(0,8)}`;
  for(const id of ['search','stage','status']) $(id).addEventListener(id==='search'?'input':'change',render);render();
 } catch(err) {$('scope').textContent='计划数据暂时不可用';$('error').hidden=false;$('error').textContent='无法读取功能状态。请刷新重试；当前不能将缺失数据视为零进度。';$('updated').textContent='数据加载失败';}
}
init();
