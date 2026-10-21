import { links } from '../data'
import Happy from './Happy'
import Summit from './Summit'

export default function Connect({ chapters }) {
  return (
    <footer className="connect" id="contact">
      <div className="connect__head">
        <img
          className="connect__avatar"
          src="https://avatars.githubusercontent.com/u/36968970?v=4&s=160"
          alt="Joseph Gao"
          width="80"
          height="80"
          loading="lazy"
        />
        <h2 className="connect__title">Say hello</h2>
        <p className="connect__lede">
          Building something that bridges software, data, and the physical world? I would like to
          hear about it.
        </p>
        <ul className="connect__links">
          <li><a href={links.linkedin} target="_blank" rel="noreferrer">LinkedIn</a></li>
          <li><a href={links.github} target="_blank" rel="noreferrer">GitHub</a></li>
          <li><a href={links.terrin} target="_blank" rel="noreferrer">Terrin.io</a></li>
        </ul>
      </div>

      <Summit chapters={chapters} />

      <div className="connect__ground">
        <Happy />
        <div className="connect__earth">
          <p className="connect__sign">
            Joseph Gao, still climbing.
          </p>
        </div>
      </div>
    </footer>
  )
}
