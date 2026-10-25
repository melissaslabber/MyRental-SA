import {AppBoundary,ConnectionNotice} from './Reliability'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import {setupNative} from './native'
setupNative()
import { DialogAccessibility } from './DialogAccessibility'
import './styles.css'
import './mobile-fix.css'
import './features.css'
import './modules.css'
import './legal.css'
import './support.css'
import './deposit.css'
import './applications.css'
import './inspections.css'
import './documents.css'
import './renewals.css'
import './learn.css'
import './maintenance-advice.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><AppBoundary><ConnectionNotice/><DialogAccessibility/><App /></AppBoundary></React.StrictMode>
)


import './experience.css'

import './membership.css'

import './finance.css'

import "./usability.css"

import "./compact.css"
