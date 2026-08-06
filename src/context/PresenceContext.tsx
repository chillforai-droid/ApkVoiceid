import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import {supabase} from '../lib/supabase';
import {useAuth} from './AuthContext';
type Ctx={onlineUsers:Set<string>;isOnline:(id?:string|null)=>boolean};
const PresenceContext=createContext<Ctx>({onlineUsers:new Set(),isOnline:()=>false});
export function PresenceProvider({children}:{children:React.ReactNode}){
 const {user}=useAuth(); const [onlineUsers,setOnlineUsers]=useState<Set<string>>(new Set());
 useEffect(()=>{if(!user){setOnlineUsers(new Set());return;} const ch=supabase.channel('voiceid:online-users',{config:{presence:{key:user.id}}});
 ch.on('presence',{event:'sync'},()=>{const state:any=ch.presenceState();const ids=new Set<string>();Object.values(state).flat().forEach((p:any)=>{if(p?.user_id)ids.add(p.user_id)});setOnlineUsers(ids)}).subscribe(async status=>{if(status==='SUBSCRIBED')await ch.track({user_id:user.id,online_at:new Date().toISOString()})});
 return()=>{ch.untrack().catch(()=>{});supabase.removeChannel(ch)}},[user]);
 const value=useMemo(()=>({onlineUsers,isOnline:(id?:string|null)=>!!id&&onlineUsers.has(id)}),[onlineUsers]);return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>
}
export const usePresence=()=>useContext(PresenceContext);
