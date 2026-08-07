import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import {Appearance,ColorSchemeName} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
export type ThemeMode='system'|'light'|'dark';
export const palettes={light:{background:'#F8FAFC',surface:'#FFFFFF',surfaceAlt:'#F1F5F9',card:'#FFFFFF',text:'#0F172A',textSecondary:'#64748B',border:'#E2E8F0',input:'#FFFFFF',inputText:'#0F172A',icon:'#64748B',primary:'#2563EB',success:'#22C55E',danger:'#EF4444'},dark:{background:'#0B1220',surface:'#0B1220',surfaceAlt:'#172033',card:'#172033',text:'#F8FAFC',textSecondary:'#94A3B8',border:'#1E293B',input:'#0B1220',inputText:'#F1F5F9',icon:'#94A3B8',primary:'#2563EB',success:'#22C55E',danger:'#EF4444'}} as const;
type ThemeCtx={mode:ThemeMode;scheme:'light'|'dark';setMode:(m:ThemeMode)=>void;colors:(typeof palettes)['light']};
const C=createContext<ThemeCtx>({mode:'system',scheme:'dark',setMode:()=>{},colors:palettes.dark});
export function ThemeProvider({children}:{children:React.ReactNode}){const[mode,setModeState]=useState<ThemeMode>('system');const[device,setDevice]=useState<ColorSchemeName>(Appearance.getColorScheme());useEffect(()=>{AsyncStorage.getItem('voiceid-theme').then(v=>{if(v==='light'||v==='dark'||v==='system')setModeState(v)});const sub=Appearance.addChangeListener(x=>setDevice(x.colorScheme));return()=>sub.remove()},[]);const setMode=(m:ThemeMode)=>{setModeState(m);AsyncStorage.setItem('voiceid-theme',m).catch(()=>{})};const scheme:'light'|'dark'=mode==='system'?(device==='light'?'light':'dark'):mode;const value=useMemo(()=>({mode,scheme,setMode,colors:palettes[scheme]}),[mode,scheme]);return <C.Provider value={value}>{children}</C.Provider>}
export const useThemeMode=()=>useContext(C);
