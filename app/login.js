'use strict';
const bridge=window.classPilotDesktop;
const response=bridge.status();
const isNew=Boolean(response.ok&&!response.exists);
const el=id=>document.getElementById(id);
if(!response.ok){el('error').textContent=response.error||'Cannot open application data store.';el('submit').disabled=true}
if(isNew){el('heading').textContent='Create your private workspace';el('subheading').textContent='Create a password and select a starting workspace.';el('eyebrow').textContent='FIRST-TIME SETUP';el('confirm-row').hidden=false;el('mode-area').hidden=false;el('startup-options').hidden=false;el('submit').textContent='Create workspace →';el('password').autocomplete='new-password'}
el('access-form').addEventListener('submit',e=>{
 e.preventDefault();
 const pass=el('password').value;
 if(isNew&&(pass.length<10||pass!==el('confirm').value)){el('error').textContent='Use at least 10 characters and matching passwords.';return}
 const mode=document.querySelector('input[name="mode"]:checked')?.value||'empty';
 const choices=[...document.querySelectorAll('input[name=subject]:checked')].map(el=>el.value);
 if(isNew&&!choices.length){el('error').textContent='Select at least one school subject.';return}
 const out=isNew?bridge.create(pass,{mode,subjects:choices,lang:el('startup-lang').value}):bridge.unlock(pass);
 if(!out.ok){el('error').textContent=out.error||'Unable to unlock.';return}
 el('error').textContent='Opening secure workspace...';el('submit').disabled=true;
});
