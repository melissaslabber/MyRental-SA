import { useEffect } from 'react'

// Apply the same keyboard behaviour to existing editors and quick-action sheets.
export function DialogAccessibility(){
  useEffect(()=>{
    let active=null, previous=null, oldOverflow=''
    const selector='.editor-backdrop > form, .editor-backdrop > .lease-editor, .modal-backdrop > .sheet'
    const focusables=()=>active?[...active.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length):[]
    const sync=()=>{
      const next=[...document.querySelectorAll(selector)].at(-1)||null
      if(next===active)return
      if(active){document.body.style.overflow=oldOverflow;if(previous?.isConnected)previous.focus()}
      active=next
      if(active){previous=document.activeElement;oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';active.setAttribute('role','dialog');active.setAttribute('aria-modal','true');active.setAttribute('aria-label',active.querySelector('h2')?.textContent||'Rental editor');(focusables()[0]||active).focus()}
    }
    const keydown=event=>{
      if(!active)return
      const list=focusables()
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();active.querySelector('.editor-head > button, .sheet-head > button')?.click()}
      if(event.key==='Tab'&&list.length){const first=list[0],last=list.at(-1);if(event.shiftKey&&(document.activeElement===first||!active.contains(document.activeElement))){event.preventDefault();last.focus()}else if(!event.shiftKey&&(document.activeElement===last||!active.contains(document.activeElement))){event.preventDefault();first.focus()}}
    }
    const observer=new MutationObserver(sync);observer.observe(document.body,{childList:true,subtree:true});sync();document.addEventListener('keydown',keydown,true)
    return ()=>{observer.disconnect();document.removeEventListener('keydown',keydown,true);if(active)document.body.style.overflow=oldOverflow}
  },[])
  return null
}
