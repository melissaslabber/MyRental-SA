export const emptyAssessment = {ordinary:'',landlord:'',tenant:'',threshold:'',term:'',special:''}
export function assessLease(a){
 const review=reason=>({kind:'review',title:'Check with a property attorney before choosing',reason})
 const excluded=reason=>({kind:'non-cpa',title:'A non-CPA lease may be appropriate',reason:reason+' Confirm the facts before using a non-CPA template. Rental housing law and other applicable protections still apply.'})
 if(!a.ordinary||!a.landlord||!a.tenant||!a.term||!a.special)return review('Complete all the questions to see a suggested route.')
 if([a.ordinary,a.landlord,a.tenant,a.term,a.special].includes('unsure'))return review('An uncertain answer can change which rules apply. Ask an attorney to confirm the position.')
 if(a.special==='yes')return review('An employment-linked arrangement, exemption or unusual circumstance needs individual review.')
 if(a.ordinary==='no')return excluded('On your answers, the rental is not supplied in the ordinary course of business. This is a fact-specific test; owning one home or calling yourself a private landlord does not decide it.')
 if(a.tenant==='state')return excluded('Transactions where the consumer is the State are generally excluded from the CPA.')
 if(a.tenant==='juristic'){
  if(!a.threshold||a.threshold==='unsure')return review('Verify the juristic tenant’s assets and turnover at the time the lease is entered into.')
  if(a.threshold==='above')return excluded('The juristic tenant’s asset value OR annual turnover equals or exceeds the published R2 million threshold.')
  if(a.landlord==='juristic')return {kind:'mixed',title:'CPA protections may apply, but section 14 is excluded',reason:'Both parties are juristic persons. Do not treat this as a wholly non-CPA lease: the section 14 exclusion is narrower. Have the lease and its cancellation and renewal terms reviewed.'}
 }
 if(a.term==='monthly')return {kind:'mixed',title:'CPA protections may apply — check the monthly lease terms',reason:'A month-to-month lease needs its own notice and termination terms. Do not automatically apply the section 14 fixed-term process or select a non-CPA template.'}
 return {kind:'cpa',title:'A CPA-compliant fixed-term lease is likely appropriate',reason:'Your answers indicate rental services supplied in the ordinary course of business to a qualifying consumer, with no identified exclusion. Include the applicable section 14 cancellation and expiry protections and have the final lease reviewed.'}
}
