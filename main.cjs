'use strict';
// ClassPilot 0.1, offline encrypted teaching portfolio. No network or AI service is used.
const {app,BrowserWindow,ipcMain,dialog,session} = require('electron');
const {join} = require('node:path');
const {existsSync,renameSync,copyFileSync,unlinkSync} = require('node:fs');
const {randomBytes,scryptSync,createCipheriv,createDecipheriv,randomUUID} = require('node:crypto');
const {DatabaseSync, backup} = require('node:sqlite');

let mainWindow;
let db;
let cryptoKey=null;
let openedData=null;
let bootMode='empty';
const DB_NAME='classpilot-data.sqlite';
const APP_ORIGIN='file://';
const MAX_BYTES=18*1024*1024;
function uid(){return randomUUID()}
function databaseFile(){return join(app.getPath('userData'),DB_NAME)}
function dbInit(){
  if(db)return db;
  db=new DatabaseSync(databaseFile());
  // Create encrypted vault for app data
  db.exec('CREATE TABLE IF NOT EXISTS private_vault (id INTEGER PRIMARY KEY CHECK(id=1), salt BLOB NOT NULL, iv BLOB NOT NULL, auth_tag BLOB NOT NULL, encrypted_json BLOB NOT NULL, revision INTEGER NOT NULL DEFAULT 1);');
  // Create audit log table for competency history
  db.exec(`CREATE TABLE IF NOT EXISTS competency_audit_log (
    id TEXT PRIMARY KEY,
    teacher_ref TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    student_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    competency_id TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    change_reason TEXT,
    evidence TEXT,
    source TEXT,
    version_id TEXT NOT NULL
  );`);
  // Create audit log tables for framework changes
  db.exec(`CREATE TABLE IF NOT EXISTS framework_audit_log (
    id TEXT PRIMARY KEY,
    teacher_ref TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    action TEXT NOT NULL,
    previous_data TEXT,
    new_data TEXT NOT NULL,
    reason TEXT,
    version_id TEXT NOT NULL
  );`);
  // Create index for efficient querying
  db.exec('CREATE INDEX IF NOT EXISTS idx_competency_audit_student ON competency_audit_log (student_id, subject_id, competency_id);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_competency_audit_timestamp ON competency_audit_log (timestamp DESC);');
  // Assessment events are immutable pedagogical records — log every entry/correction.
  db.exec(`CREATE TABLE IF NOT EXISTS assessment_audit_log (
    id TEXT PRIMARY KEY,
    teacher_ref TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    student_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    assessment_id TEXT NOT NULL,
    action TEXT NOT NULL,
    previous_data TEXT,
    new_data TEXT NOT NULL,
    reason TEXT,
    framework_version_id TEXT NOT NULL
  );`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_assessment_audit_student ON assessment_audit_log (student_id, subject_id, timestamp DESC);');
  // M2.1 — positioning frameworks, levels, cycles and assessment events (append-only history)
  db.exec('CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  db.exec(`CREATE TABLE IF NOT EXISTS positioning_frameworks (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    scope TEXT,
    version_id TEXT NOT NULL,
    version_note TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS positioning_levels (
    id TEXT PRIMARY KEY,
    framework_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    observable_criteria TEXT,
    order_index INTEGER NOT NULL,
    version_id TEXT NOT NULL,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  db.exec('CREATE TABLE IF NOT EXISTS positioning_level_competencies (level_id TEXT NOT NULL, competency_id TEXT NOT NULL, PRIMARY KEY (level_id, competency_id))');
  db.exec('CREATE TABLE IF NOT EXISTS positioning_level_prerequisites (level_id TEXT NOT NULL, prerequisite_level_id TEXT NOT NULL, PRIMARY KEY (level_id, prerequisite_level_id))');
  db.exec(`CREATE TABLE IF NOT EXISTS assessment_cycles (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL,
    name TEXT NOT NULL,
    framework_id TEXT,
    start_date TEXT,
    end_date TEXT,
    type TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS assessment_events (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    framework_id TEXT,
    framework_version_id TEXT NOT NULL,
    cycle_id TEXT,
    type TEXT NOT NULL,
    date TEXT NOT NULL,
    level_id TEXT,
    score TEXT,
    max_score TEXT,
    rubric TEXT,
    competency_ids TEXT,
    note TEXT,
    source TEXT,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_assessment_events_student ON assessment_events (student_id, subject_id, date DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_assessment_events_cycle ON assessment_events (cycle_id, date DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_frameworks_subject ON positioning_frameworks (subject_id, archived)');
  return db;
}
const SUBJECT_LABELS={fr:'Français',math:'Mathématiques',ar:'العربية',science:'Activité scientifique',en:'English',social:'Sciences sociales',islamic:'Éducation islamique',art:'Éducation artistique',pe:'Éducation physique'};
function subLabel(id){return SUBJECT_LABELS[id]||id}
function row(){return dbInit().prepare('SELECT salt,iv,auth_tag,encrypted_json FROM private_vault WHERE id=1').get()}
function vaultExists(){return Boolean(row())}
function derive(pass,salt){return scryptSync(pass,salt,32,{N:32768,r:8,p:1,maxmem:64*1024*1024})}
function encryptData(data,key){
  const content=Buffer.from(JSON.stringify(data),'utf8');
  if(content.length>MAX_BYTES)throw new Error('Student database exceeds the v0.1 limit (18 MB). Please export and archive old data.');
  const iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',key,iv);
  const encrypted=Buffer.concat([cipher.update(content),cipher.final()]);
  return {iv,tag:cipher.getAuthTag(),encrypted};
}
function decryptData(record,key){
  const d=createDecipheriv('aes-256-gcm',key,record.iv);
  d.setAuthTag(record.auth_tag);
  return JSON.parse(Buffer.concat([d.update(record.encrypted_json),d.final()]).toString('utf8'));
}
function persist(data){
  if(!cryptoKey)throw new Error('The private data vault is locked.');
  if(!data||typeof data!=='object'||!Array.isArray(data.students)||!Array.isArray(data.assessments)||!Array.isArray(data.activeSubjects))throw new Error('Invalid educational data structure');
  const sealed=encryptData(data,cryptoKey);
  const dbConn=dbInit();
  dbConn.prepare('UPDATE private_vault SET iv=?, auth_tag=?, encrypted_json=?, revision=revision+1 WHERE id=1').run(sealed.iv,sealed.tag,sealed.encrypted);
  openedData=data;
}

function logCompetencyChange(teacherRef, studentId, subjectId, competencyId, previousStatus, newStatus, changeReason, evidence, source, versionId){
  if(!cryptoKey)throw new Error('The private data vault is locked.');
  const dbConn=dbInit();
  const id=uid();
  const timestamp=new Date().toISOString();
  try{
    dbConn.prepare('INSERT INTO competency_audit_log (id, teacher_ref, timestamp, student_id, subject_id, competency_id, previous_status, new_status, change_reason, evidence, source, version_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(
      id, teacherRef, timestamp, studentId, subjectId, competencyId, previousStatus, newStatus, changeReason, evidence, source, versionId
    );
    return {ok:true, id};
  }catch(err){
    return {ok:false, error:String(err.message)};
  }
}

function logFrameworkChange(teacherRef, entityType, entityId, entityName, action, previousData, newData, reason, versionId){
  if(!cryptoKey)throw new Error('The private data vault is locked.');
  const dbConn=dbInit();
  const id=uid();
  const timestamp=new Date().toISOString();
  try{
    dbConn.prepare('INSERT INTO framework_audit_log (id, teacher_ref, timestamp, entity_type, entity_id, entity_name, action, previous_data, new_data, reason, version_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
      id, teacherRef, timestamp, entityType, entityId, entityName, action, previousData, newData, reason, versionId
    );
    return {ok:true, id};
  }catch(err){
    return {ok:false, error:String(err.message)};
  }
}
function logAssessmentChange(teacherRef, studentId, subjectId, assessmentId, action, previousData, newData, reason, frameworkVersionId){
  if(!cryptoKey)throw new Error('The private data vault is locked.');
  const dbConn=dbInit();
  const id=uid();
  const timestamp=new Date().toISOString();
  try{
    dbConn.prepare('INSERT INTO assessment_audit_log (id, teacher_ref, timestamp, student_id, subject_id, assessment_id, action, previous_data, new_data, reason, framework_version_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
      id, teacherRef, timestamp, studentId, subjectId, assessmentId, action, previousData, newData, reason, frameworkVersionId
    );
    return {ok:true, id};
  }catch(err){
    return {ok:false, error:String(err.message)};
  }
}
function migrateDataIfNeeded(){
  if(!cryptoKey) return; // Run only after vault is unlocked
  const conn=dbInit();
  const meta=conn.prepare('SELECT value FROM app_meta WHERE key=?').get('schema_version');
  const current=meta?Number(meta.value):0;
  if(current>=SCHEMA_VERSION)return;

  try {
    conn.exec('BEGIN IMMEDIATE');
    const now=new Date().toISOString();
    // M2.1 migration: promote legacy in-memory positioning/assessment records into relational tables.
    if(openedData){
      if(openedData.levels){
        for(const [subId, list] of Object.entries(openedData.levels)){
          if(!Array.isArray(list))continue;
          const fid=`frw-${subId}-${uid().slice(0,8)}`;
          conn.prepare('INSERT OR IGNORE INTO positioning_frameworks (id,subject_id,name,description,scope,version_id,version_note,active,archived,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(fid,subId,'Framework '+subId,'Migrated from v0.1 vault','class','v1','Initial version',1,0,now,now);
          for(const l of list){
            if(!l)continue;
            conn.prepare('INSERT OR IGNORE INTO positioning_levels (id,framework_id,subject_id,name,description,observable_criteria,order_index,version_id,archived,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(l.id||uid(),fid,subId,l.name||'Niveau',l.description||'',l.description||'',l.order||1,'v1',l.archived?1:0,now,now);
          }
        }
      }
      if(Array.isArray(openedData.assessments)){
        for(const a of openedData.assessments){
          if(!a)continue;
          // Fixed placeholder count: 18 columns, 18 placeholders.
          // Explicitly handle zero-valued scores by using '' if undefined/null, but keeping '0' if it is '0'
          const score = (a.score === undefined || a.score === null) ? '' : String(a.score);
          conn.prepare('INSERT OR IGNORE INTO assessment_events (id,student_id,subject_id,framework_id,framework_version_id,cycle_id,type,date,level_id,score,max_score,rubric,competency_ids,note,source,is_deleted,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
            a.id||uid(),a.studentId,a.subject,null,'v1',null,a.type||'pre',a.date||now,a.levelId||null,score,a.maxScore||'',a.rubric||'',JSON.stringify(a.competencyIds||[]),a.note||'','vault-migration',0,now,now
          );
        }
      }
    }
    conn.prepare('INSERT OR REPLACE INTO app_meta (key,value) VALUES (?,?)').run('schema_version',String(SCHEMA_VERSION));
    conn.exec('COMMIT');
  } catch (err) {
    conn.exec('ROLLBACK');
    console.error('Migration failed, rolled back:', err);
    throw err; // Ensure failure is known
  }
}
const SCHEMA_VERSION=1;
function createVault(password,mode,subjects,lang){
  if(vaultExists())throw new Error('A data vault already exists.');
  if(typeof password!=='string'||password.length<10)throw new Error('Use a password with at least 10 characters.');
  const salt=randomBytes(24);
  const key=derive(password,salt);
  const allowable=['fr','math','ar','science','en','social','islamic','art','pe'];
  const chosen=Array.isArray(subjects)?[...new Set(subjects.filter(s=>allowable.includes(s)))]:['fr','math','ar','science'];
  if(!chosen.length)throw new Error('Select at least one school subject.');
  const selectedLanguage=['fr','en','ar'].includes(lang)?lang:'fr';
  const starter={students:[],activeSubjects:chosen,assessments:[],lang:selectedLanguage,planLang:selectedLanguage,firstRunMode:mode};
  const sealed=encryptData(starter,key);
  dbInit().prepare('INSERT INTO private_vault (id,salt,iv,auth_tag,encrypted_json) VALUES(1,?,?,?,?)').run(salt,sealed.iv,sealed.tag,sealed.encrypted);
  cryptoKey=key;
  openedData=starter;
  bootMode=mode==='sample'?'sample':'empty';
}
function openVault(password){
  if(typeof password!=='string'||!password)throw new Error('Enter the data vault password.');
  const saved=row();
  if(!saved)throw new Error('No data vault found. Create one first.');
  let key;
  try{key=derive(password,saved.salt);const data=decryptData(saved,key);cryptoKey=key;openedData=data;bootMode='existing';}
  catch(e){throw new Error('Incorrect password or corrupted data vault.');}
}
function authorized(event){if(!mainWindow||event.sender!==mainWindow.webContents||event.sender.getURL().startsWith(APP_ORIGIN)===false)throw new Error('Unauthorized request')}
function result(fn){try{return {ok:true,...fn()}}catch(err){return {ok:false,error:String(err.message||err)}}}
function loadScreen(name){mainWindow.loadFile(join(__dirname,'app',name))}
function createWindow(){
  mainWindow=new BrowserWindow({width:1440,height:900,minWidth:980,minHeight:660,show:false,backgroundColor:'#f4f6fa',autoHideMenuBar:true,webPreferences:{preload:join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,devTools:!app.isPackaged}});
  mainWindow.once('ready-to-show',()=>mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  mainWindow.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith(APP_ORIGIN))event.preventDefault()});
  loadScreen('login.html');
}

ipcMain.on('vault-info',(event)=>{authorized(event);event.returnValue=result(()=>({exists:vaultExists()}))});
ipcMain.on('vault-create',(event,args)=>{authorized(event);event.returnValue=result(()=>{createVault(args?.password,args?.mode,args?.subjects,args?.lang);setImmediate(()=>loadScreen('index.html'));return {}})});
ipcMain.on('vault-unlock',(event,args)=>{authorized(event);event.returnValue=result(()=>{openVault(args?.password);setImmediate(()=>loadScreen('index.html'));return {}})});
ipcMain.on('vault-initial',(event)=>{authorized(event);event.returnValue=result(()=>{if(!cryptoKey)throw new Error('Locked');return {mode:bootMode,data:openedData}})});
ipcMain.on('vault-save',(event,args)=>{authorized(event);event.returnValue=result(()=>{persist(args);return {saved:true}})});
ipcMain.on('vault-lock',(event)=>{authorized(event);event.returnValue=result(()=>{cryptoKey=null;openedData=null;setImmediate(()=>loadScreen('login.html'));return {}})});

ipcMain.on('log-competency-change',(event, ...args)=>{
  authorized(event);
  event.returnValue=result(()=>logCompetencyChange(...args));
});

ipcMain.on('log-framework-change',(event, ...args)=>{
  authorized(event);
  event.returnValue=result(()=>logFrameworkChange(...args));
});
ipcMain.on('log-assessment-change',(event, ...args)=>{
  authorized(event);
  event.returnValue=result(()=>logAssessmentChange(...args));
});
ipcMain.on('student-archive',(event,args)=>{authorized(event);event.returnValue=result(()=>{if(!openedData||!args?.studentId)throw new Error('No student selected.');const st=openedData.students.find(s=>s.id===args.studentId);if(!st)throw new Error('Student not found.');if(st.archived)throw new Error('Student already archived.');st.archived=true;st.archivedAt=new Date().toISOString();st.archivedBy=args?.teacherRef||'Teacher';persist(openedData);return {ok:true}})});
ipcMain.on('student-restore',(event,args)=>{authorized(event);event.returnValue=result(()=>{if(!openedData||!args?.studentId)throw new Error('No student selected.');const st=openedData.students.find(s=>s.id===args.studentId);if(!st)throw new Error('Student not found.');if(!st.archived)throw new Error('Student is not archived.');delete st.archived;delete st.archivedAt;delete st.archivedBy;persist(openedData);return {ok:true}})});
ipcMain.on('student-delete',(event,args)=>{authorized(event);event.returnValue=result(()=>{if(!openedData||!args?.studentId)throw new Error('No student selected.');if(args?.confirm!==true)throw new Error('Deletion requires explicit confirmation.');const st=openedData.students.find(s=>s.id===args.studentId);if(!st)throw new Error('Student not found.');const linked=openedData.assessments.some(a=>a.studentId===args.studentId)||openedData.observations.some(o=>o.studentId===args.studentId)||openedData.groups.some(g=>g.members.includes(args.studentId));if(linked)throw new Error('Refuse unsafe delete: student has linked records. Archive instead.');openedData.students=openedData.students.filter(s=>s.id!==args.studentId);persist(openedData);return {ok:true}})});

ipcMain.handle('vault-backup',async(event)=>{
  authorized(event);
  if(!cryptoKey)return {ok:false,error:'Unlock the vault first.'};
  const answer=await dialog.showSaveDialog(mainWindow,{title:'Encrypted ClassPilot backup',defaultPath:`ClassPilot-Backup-${new Date().toISOString().slice(0,10)}.sqlite`,filters:[{name:'ClassPilot encrypted backup',extensions:['sqlite']}]});
  if(answer.canceled||!answer.filePath)return {ok:false,canceled:true};
  try{
    // SQLite backup API gives consistent backups, including when using WAL; no password is exported.
    await backup(dbInit(), answer.filePath);
    return {ok:true,path:answer.filePath};
  }catch(err){return {ok:false,error:String(err.message)}}
});
ipcMain.handle('vault-restore',async(event)=>{
  authorized(event);
  if(!cryptoKey)return {ok:false,error:'Unlock the vault first.'};
  const answer=await dialog.showOpenDialog(mainWindow,{title:'Restore encrypted ClassPilot backup',properties:['openFile'],filters:[{name:'ClassPilot database',extensions:['sqlite']}]});
  if(answer.canceled||!answer.filePaths[0])return {ok:false,canceled:true};
  const source=answer.filePaths[0];
  try{
    // Verify SQLite structure before touching the current database.
    const candidate=new DatabaseSync(source,{readOnly:true});
    const check=candidate.prepare('SELECT salt,iv,auth_tag,encrypted_json FROM private_vault WHERE id=1').get();
    if(!check)throw new Error('No encrypted ClassPilot vault in this file.');
    // The restored vault may use a different password; force authentication after restart.
    candidate.close();
    const backupPath=databaseFile()+'.before-restore';
    dbInit().close();db=null;
    copyFileSync(databaseFile(),backupPath);
    copyFileSync(source,databaseFile());
    cryptoKey=null;openedData=null;
    setImmediate(()=>loadScreen('login.html'));
    return {ok:true,requiresLogin:true};
  }catch(err){try{dbInit()}catch{} return {ok:false,error:String(err.message||err)}}
});
app.whenReady().then(()=>{
  session.defaultSession.setPermissionRequestHandler((_wc,_p,callback)=>callback(false));
  session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{
    // Do not load third-party resources from any renderer.
    const isLocal=details.url.startsWith(APP_ORIGIN)||details.url.startsWith('devtools:')||details.url.startsWith('blob:')||details.url.startsWith('data:');
    callback({cancel:!isLocal});
  });
  createWindow();
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow()});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
app.on('before-quit',()=>{cryptoKey=null;openedData=null;try{db?.close()}catch{}});
