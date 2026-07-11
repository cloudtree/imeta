/** Visme-style leaning character beside the login form */
export default function VismeBuddy({ className = '' }) {
  return (
    <div className={['visme-buddy', className].filter(Boolean).join(' ')} aria-hidden="true">
      <div className="visme-buddy__shadow" />
      <div className="visme-buddy__body">
        <div className="visme-buddy__head">
          <span className="visme-buddy__hair" />
          <span className="visme-buddy__face" />
          <span className="visme-buddy__mustache" />
          <span className="visme-buddy__glasses" />
        </div>
        <div className="visme-buddy__torso">
          <span className="visme-buddy__arm visme-buddy__arm--back" />
          <span className="visme-buddy__shirt" />
          <span className="visme-buddy__arm visme-buddy__arm--lean" />
        </div>
        <div className="visme-buddy__legs">
          <span className="visme-buddy__leg visme-buddy__leg--l" />
          <span className="visme-buddy__leg visme-buddy__leg--r" />
          <span className="visme-buddy__shoe visme-buddy__shoe--l" />
          <span className="visme-buddy__shoe visme-buddy__shoe--r" />
        </div>
      </div>
    </div>
  )
}
