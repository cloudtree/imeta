export default function LoginCat3D() {
  return (
    <div className="login-cat-scene" aria-hidden="true">
      <div className="login-cat-scene__glow" />
      <div className="login-cat-scene__stage">
        <img
          className="login-cat-scene__cat"
          src="/images/login-cat-3d.png"
          alt=""
          draggable={false}
        />
        <div className="login-cat-scene__shadow" />
      </div>
    </div>
  )
}
