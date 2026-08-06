import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react-native';
import { useVoiceCall } from '../context/VoiceCallContext';
export default function CallOverlay(){
 const {callState,otherProfile,acceptCall,rejectCall,endCall,isMuted,toggleMute}=useVoiceCall();
 const [seconds,setSeconds]=useState(0);
 useEffect(()=>{ if(callState!=='connected'){setSeconds(0);return;} const t=setInterval(()=>setSeconds(s=>s+1),1000); return()=>clearInterval(t);},[callState]);
 if(callState==='idle')return null;
 const time=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
 return <Modal visible transparent={false} animationType="fade" onRequestClose={()=>{}}><View style={s.root}>
   <View style={s.avatar}>{otherProfile?.avatar_url?<Image source={{uri:otherProfile.avatar_url}} style={s.avatarImg}/>:<Text style={s.avatarText}>{(otherProfile?.display_name??'?').charAt(0).toUpperCase()}</Text>}</View>
   <Text style={s.name}>{otherProfile?.display_name??'VoiceID User'}</Text>
   <Text style={s.status}>{callState==='ringing-incoming'?'Incoming voice call':callState==='ringing-outgoing'?'Calling…':callState==='connecting'?'Connecting…':time}</Text>
   {callState==='ringing-incoming'?<View style={s.row}><TouchableOpacity style={[s.circle,s.reject]} onPress={rejectCall}><PhoneOff color="#fff" size={30}/></TouchableOpacity><TouchableOpacity style={[s.circle,s.accept]} onPress={acceptCall}><Phone color="#fff" size={30}/></TouchableOpacity></View>:
   <View style={s.row}>{callState==='connected'&&<><TouchableOpacity style={[s.circle,s.control]} onPress={toggleMute}>{isMuted?<MicOff color="#fff"/>:<Mic color="#fff"/>}</TouchableOpacity></>}<TouchableOpacity style={[s.circle,s.reject]} onPress={endCall}><PhoneOff color="#fff" size={30}/></TouchableOpacity></View>}
 </View></Modal>;
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#07111F',alignItems:'center',justifyContent:'center',padding:24},avatar:{width:112,height:112,borderRadius:56,backgroundColor:'#22C55E',alignItems:'center',justifyContent:'center',marginBottom:22},avatarImg:{width:'100%',height:'100%'},avatarText:{fontSize:44,fontWeight:'800',color:'#fff'},name:{fontSize:25,fontWeight:'800',color:'#F8FAFC'},status:{fontSize:16,color:'#94A3B8',marginTop:10,marginBottom:70},row:{flexDirection:'row',gap:26,alignItems:'center'},circle:{width:68,height:68,borderRadius:34,alignItems:'center',justifyContent:'center'},reject:{backgroundColor:'#EF4444'},accept:{backgroundColor:'#22C55E'},control:{backgroundColor:'#334155'},active:{backgroundColor:'#2563EB'}});
