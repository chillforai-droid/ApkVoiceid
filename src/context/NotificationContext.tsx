import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type AppNotification = { id:string; user_id:string; actor_id:string|null; title:string; message:string|null; type:string; related_id:string|null; secondary_id:string|null; is_read:boolean; created_at:string };
type Ctx={notifications:AppNotification[];unreadCount:number;loading:boolean;refresh:()=>Promise<void>;markRead:(id:string)=>Promise<void>;markAllRead:()=>Promise<void>;remove:(id:string)=>Promise<void>};
const NotificationContext=createContext<Ctx>({} as Ctx);
export function NotificationProvider({children}:{children:React.ReactNode}){
 const {user}=useAuth(); const [notifications,setNotifications]=useState<AppNotification[]>([]); const [loading,setLoading]=useState(true);
 const refresh=useCallback(async()=>{if(!user){setNotifications([]);setLoading(false);return;} const {data}=await supabase.from('notifications').select('*').eq('user_id',user.id).order('created_at',{ascending:false}).limit(50); setNotifications((data??[]) as AppNotification[]); setLoading(false)},[user]);
 useEffect(()=>{refresh(); if(!user)return; const ch=supabase.channel(`mobile-notifications:${user.id}`)
  .on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:`user_id=eq.${user.id}`},p=>setNotifications(x=>[p.new as AppNotification,...x.filter(n=>n.id!==(p.new as any).id)]))
  .on('postgres_changes',{event:'UPDATE',schema:'public',table:'notifications',filter:`user_id=eq.${user.id}`},p=>setNotifications(x=>x.map(n=>n.id===(p.new as any).id?p.new as AppNotification:n)))
  .on('postgres_changes',{event:'DELETE',schema:'public',table:'notifications',filter:`user_id=eq.${user.id}`},p=>setNotifications(x=>x.filter(n=>n.id!==(p.old as any).id))).subscribe();
  return()=>{supabase.removeChannel(ch)};
 },[user,refresh]);
 const markRead=useCallback(async(id:string)=>{setNotifications(x=>x.map(n=>n.id===id?{...n,is_read:true}:n));await supabase.from('notifications').update({is_read:true}).eq('id',id)},[]);
 const markAllRead=useCallback(async()=>{if(!user)return;setNotifications(x=>x.map(n=>({...n,is_read:true})));await supabase.from('notifications').update({is_read:true}).eq('user_id',user.id).eq('is_read',false)},[user]);
 const remove=useCallback(async(id:string)=>{setNotifications(x=>x.filter(n=>n.id!==id));await supabase.from('notifications').delete().eq('id',id)},[]);
 const value=useMemo(()=>({notifications,unreadCount:notifications.filter(n=>!n.is_read).length,loading,refresh,markRead,markAllRead,remove}),[notifications,loading,refresh,markRead,markAllRead,remove]);
 return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}
export const useNotifications=()=>useContext(NotificationContext);
