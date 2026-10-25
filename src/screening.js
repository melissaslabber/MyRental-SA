export const screeningChecks=[['identity','Identity checked against the applicant'],['consent','Written screening consent retained'],['income','Income evidence reviewed consistently'],['employment','Employment / source of income verified'],['references','Rental references checked'],['report','Provider report reviewed by the landlord']]
export function validateScreening(form){
 if(!form.applicant_name?.trim())throw new Error('Enter the applicant name.')
 if(!form.property_id)throw new Error('Choose a property.')
 if(form.stage!=='awaiting_consent'&&(!form.consent_date||!form.consent_reference?.trim()))throw new Error('Record written consent and where the signed proof is kept before progressing.')
 if(['report_received','reviewed'].includes(form.stage)&&!form.report_path&&!form.provider_reference?.trim())throw new Error('Upload the report or record the provider report reference.')
 if(form.stage==='reviewed'&&screeningChecks.some(([key])=>!form.checks?.[key]))throw new Error('Finish the landlord review checklist before marking the screening reviewed.')
 return true
}
