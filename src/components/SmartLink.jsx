import { Link } from 'react-router-dom'
import { isExternal } from '../lib/util'

// ভেতরের লিংকে Link, বাইরের লিংকে নতুন ট্যাবে খোলা <a>
export default function SmartLink({ to, children, ...rest }) {
  if (!to) return <span {...rest}>{children}</span>
  if (isExternal(to)) return <a href={to} target="_blank" rel="noreferrer noopener" {...rest}>{children}</a>
  return <Link to={to} {...rest}>{children}</Link>
}
