import { HamburgerDivider } from '~/components/HamburgerDivider';
import { HamburgerMenu } from '~/components/HamburgerMenu';
import { LogoutButton } from '~/components/LogoutButton';

// pages/TimersPage.tsx
export function TimersPage() {
  return (
    <div
      className="container wordlist-root"
      style={{
        maxWidth: 1080,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: '0.75rem',
        paddingBottom: '0.75rem',
      }}
    >
      <div className="position-relative mb-3" style={{ minHeight: 40 }}>
        <div className="position-absolute" style={{ top: 0, right: 0 }}>
          <HamburgerMenu>
            <li>
              <button className="dropdown-item" type="button" onClick={() => {}}>
                메뉴1
              </button>
            </li>

            <HamburgerDivider />
            <LogoutButton />
          </HamburgerMenu>
        </div>
      </div>

      <div className="d-flex mt-2 mb-3 wordlist-core-row">
        본문
      </div>
    </div>
  );
}
