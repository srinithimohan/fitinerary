'use client';

import Link from 'next/link';

import {
  Show,
  SignInButton,
  UserButton,
} from '@clerk/nextjs';

export default function Navbar() {
  return (
    <nav
      className="
        fixed
        bottom-6
        right-6
        top-6
        z-50
        flex
        w-28
        flex-col
        justify-between
        bg-transparent
        py-4
      "
    >
      {/* Top navigation */}
      <div className="flex flex-col items-center gap-4">
        <Link
          href="/"
          className="
            w-full
            rounded-xl
            px-3
            py-3
            text-center
            font-medium
            hover:bg-black/5
          "
        >
          Home
        </Link>

        <Link
          href="/past-boards"
          className="
            w-full
            rounded-xl
            px-3
            py-3
            text-center
            font-medium
            leading-tight
            hover:bg-black/5
          "
        >
          <span className="block">
            Past
          </span>

          <span className="block">
            Boards
          </span>
        </Link>

        <Link
          href="/closet"
          className="
            w-full
            rounded-xl
            px-3
            py-3
            text-center
            font-medium
            hover:bg-black/5
          "
        >
          Closet
        </Link>
      </div>

      {/* Bottom authentication */}
      <div className="flex justify-center pb-2">
        <Show when="signed-out">
          <SignInButton mode="modal">
            <button
              type="button"
              className="
                rounded-xl
                px-3
                py-3
                font-medium
                hover:bg-black/5
              "
            >
              Login
            </button>
          </SignInButton>
        </Show>

        <Show when="signed-in">
          <UserButton />
        </Show>
      </div>
    </nav>
  );
}