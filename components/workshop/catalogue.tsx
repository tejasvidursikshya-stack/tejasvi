'use client';
import {useId} from 'react';
import {outputNames,type Output} from '../../lib/atelier';
export function OutputSelect({format,onChange,id}:{format:Output;onChange:(f:Output)=>void;id?:string}){const label=useId();return <label className="wk-output-select"><span id={label}>Output</span><select aria-labelledby={label} id={id} value={format} onChange={e=>onChange(e.target.value as Output)}>{Object.entries(outputNames).map(([k,label])=><option key={k} value={k}>{label}</option>)}</select></label>}

