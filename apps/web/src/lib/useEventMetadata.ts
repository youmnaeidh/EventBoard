import {useEffect} from 'react';
import {assetUrl} from './assets';
import {mediaUrl, shareUrl} from './api';
import type {EventItem} from '../types';
/** SPA metadata mirrors the server-rendered public share endpoint. */
export function useEventMetadata(event?:EventItem){
  useEffect(()=>{
    if(!event || event.publicationStatus === 'draft')return;
    const definitions: [string,string,string][]=[
      ['name','description',event.summary],['property','og:title',event.title],
      ['property','og:description',event.summary],['property','og:url',shareUrl(event.slug)],
      ['property','og:image',event.image ? new URL(mediaUrl(assetUrl(event.image)),window.location.href).href : '']
    ];
    const restore=definitions.map(([attr,key,content])=>{
      const previous=document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
      const old=previous?.content;
      const el=previous ?? document.createElement('meta');
      el.setAttribute(attr,key);el.content=content;if(!previous)document.head.append(el);
      return ()=>{if(previous)el.content=old??'';else el.remove();};
    });
    return ()=>restore.forEach(fn=>fn());
  },[event?.id,event?.title,event?.summary,event?.image,event?.publicationStatus,event?.slug]);
}
