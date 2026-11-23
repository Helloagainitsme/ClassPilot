'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('classPilotDesktop',{
  status:()=>ipcRenderer.sendSync('vault-info'),
  create:(password,options)=>ipcRenderer.sendSync('vault-create',{password,...options}),
  unlock:password=>ipcRenderer.sendSync('vault-unlock',{password}),
  initial:()=>ipcRenderer.sendSync('vault-initial'),
  save:data=>ipcRenderer.sendSync('vault-save',data),
  lock:()=>ipcRenderer.sendSync('vault-lock'),
  backup:()=>ipcRenderer.invoke('vault-backup'),
  restore:()=>ipcRenderer.invoke('vault-restore'),
  logCompetencyChange:(...args)=>ipcRenderer.sendSync('log-competency-change',...args),
  logFrameworkChange:(...args)=>ipcRenderer.sendSync('log-framework-change',...args),
  logAssessmentChange:(...args)=>ipcRenderer.sendSync('log-assessment-change',...args),
  archiveStudent:(args)=>ipcRenderer.sendSync('student-archive',args),
  restoreStudent:(args)=>ipcRenderer.sendSync('student-restore',args),
  deleteStudent:(args)=>ipcRenderer.sendSync('student-delete',args)
});
