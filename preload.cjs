'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('classPilotDesktop',{
  status:()=>ipcRenderer.sendSync('vault-info'),
  create:(password,options)=>ipcRenderer.sendSync('vault-create',{password,...options}),
  unlock:password=>ipcRenderer.sendSync('vault-unlock',{password}),
  initial:()=>ipcRenderer.sendSync('vault-initial'),
  save:(data,expectedRevision)=>ipcRenderer.sendSync('vault-save',{data,expectedRevision}),
  lock:()=>ipcRenderer.sendSync('vault-lock'),
  backup:()=>ipcRenderer.invoke('vault-backup'),
  restore:password=>ipcRenderer.invoke('vault-restore',{password})
});
