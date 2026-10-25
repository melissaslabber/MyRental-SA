import {openExternal} from './native'
export function PropertyListingLink({notify}){
 const open=async url=>{try{await openExternal(url)}catch(e){notify(e.message||'Could not open Property24. Please try again.')}}
 return <section className="credit-check-link"><div><h3>Property available to rent?</h3><p>Create your rental advert on Property24. Sign up or sign in there to list and manage it.</p></div><div className="invoice-actions"><button className="primary" onClick={()=>open('https://www.property24.com/private-listing/rent-my-property')}>List on Property24</button><button className="text-btn" onClick={()=>open('https://manage.property24.com/')}>Property24 sign in</button></div></section>
}
