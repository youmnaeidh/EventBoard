import {useEffect} from 'react';
import {assetUrl} from './assets';
import type {EventItem} from '../types';
/** Client metadata helps in-app sharing. Static Pages crawlers still need a prerendered origin. */
export function useEventMetadata(event?:EventItem){
  useEffect(()=>{
    if(!event)return;
    const definitions: [string,string,string][]=[
      ['name','description',event.summary],['property','og:title',event.title],
      ['property','og:description',event.summary],['property','og:url',window.location.href],
      ['property','og:image',event.image ? new URL(assetUrl(event.image),window.location.href).href : '']
    ];
    const restore=definitions.map(([attr,key,content])=>{
      const previous=document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
      const old=previous?.content;
      const el=previous ?? document.createElement('meta');
      el.setAttribute(attr,key);el.content=content;if(!previous)document.head.append(el);
      return ()=>{if(previous)el.content=old??'';else el.remove();};
    });
    return ()=>restore.forEach(fn=>fn());
  },[event?.id,event?.title,event?.summary,event?.image]);
}
