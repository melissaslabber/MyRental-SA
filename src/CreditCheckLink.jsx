import {openExternal} from './native'
export function CreditCheckLink({notify}){
 const open=async url=>{try{await openExternal(url)}catch(e){notify(e.message||'Could not open MRI TPN. Please try again.')}}
 return <section className="credit-check-link"><div><h3>Tenant credit checks</h3><p>Sign up with MRI TPN and run the check on their website. Obtain the applicant’s written consent first.</p></div><div className="invoice-actions"><button className="primary" onClick={()=>open('https://app.tpn.co.za/')}>Open MRI TPN</button><button className="text-btn" onClick={()=>open('https://sso.tpn.co.za/')}>Already registered? Sign in</button></div></section>
}
