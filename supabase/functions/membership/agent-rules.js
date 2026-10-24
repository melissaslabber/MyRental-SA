const clean=(v,max)=>String(v||'').trim().slice(0,max)
export function contactFields(body){
 if(body.consent!==true)throw new Error('Please agree to sharing your details for the requested agent contact.')
 if(!/^[a-f0-9-]{36}$/i.test(body.requestKey||''))throw new Error('Refresh and try again.')
 const fields={first_name:clean(body.firstName,100),surname:clean(body.surname,100),email:clean(body.email,254).toLowerCase(),phone:clean(body.phone,40),property_address:clean(body.address,500),notes:clean(body.notes,1000)}
 if(!fields.first_name||!fields.surname||!fields.property_address||!/^\+?[\d ()-]{7,40}$/.test(fields.phone)||!/^\S+@[^\s@]+\.[^\s@]+$/.test(fields.email)||/[\r\n]/.test(fields.email))throw new Error('Enter your name, surname, valid email, phone number and property address.')
 return fields
}
export function contactEmail(row){return {subject:'MyRental SA: landlord requests Pam Golding agent contact',text:`A landlord has asked for a Pam Golding rental agent to contact them.\n\nName: ${row.first_name}\nSurname: ${row.surname}\nEmail: ${row.email}\nPhone: ${row.phone}\nProperty address: ${row.property_address}\n\nAdditional information:\n${row.notes||'None supplied.'}\n\nConsent: requested contact and permission to share these details with the MyRental SA team and a Pam Golding rental agent.\nRecorded: ${row.consented_at}\nRequest reference: ${row.id}\n\nPlease follow up using the landlord details above. This is a contact request, not an appointment or signed mandate.\n\nMyRental SA`}}
