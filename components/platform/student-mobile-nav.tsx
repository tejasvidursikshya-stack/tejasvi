'use client';
import {useEffect} from 'react';
import {House, BookOpen, ChartNoAxesCombined, Menu} from 'lucide-react';
import {useSidebar} from '@/components/ui/sidebar';

export function StudentMobileNav({active,onNavigate}:{active:string;onNavigate:(view:'overview'|'courses'|'progress')=>void}){
 const {setOpenMobile,openMobile}=useSidebar();
 // Close the account drawer when one of its workspace destinations opens.
 useEffect(()=>{setOpenMobile(false)},[active,setOpenMobile]);
 const items=[{view:'overview',label:'Home',Icon:House},{view:'courses',label:'Subjects',Icon:BookOpen},{view:'progress',label:'Progress',Icon:ChartNoAxesCombined}] as const;
 return <nav className="student-mobile-nav" aria-label="Student navigation">
  {items.map(({view,label,Icon})=><button key={view} type="button" aria-current={active===view?'page':undefined} onClick={()=>onNavigate(view)}><Icon size={21} aria-hidden="true"/><span>{label}</span></button>)}
  <button type="button" aria-expanded={openMobile} aria-label="More: attendance, optional courses, Tejasvi AI and account" onClick={()=>setOpenMobile(true)}><Menu size={21} aria-hidden="true"/><span>More</span></button>
 </nav>;
}
