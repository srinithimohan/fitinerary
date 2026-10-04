'use client';

import Link from 'next/link';

import {
  Grid3X3,
  House,
  Shirt,
  User,
} from 'lucide-react';

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
        text-[#4D5382]
        py-4
      "
    >
      {/* Top navigation */}
      <div className="mt-12 flex flex-col items-center gap-4">
        <Link
          href="/"
          className="
            flex
            w-full
            flex-col
            items-center
            gap-2
            rounded-xl
            px-3
            py-3
            text-center
            text-[#4D5382]
            font-medium
            hover:bg-black/5
          "
        >
          <House
            size={26}
            strokeWidth={1.7}
            
          />

          <span>
            home
          </span>
        </Link>

        <Link
          href="/past-boards"
          className="
            flex
            w-full
            flex-col
            items-center
            gap-2
            rounded-xl
            px-3
            py-3
            text-center
            font-medium
            text-[#4D5382]
            leading-tight
            hover:bg-black/5
          "
        >
          <Grid3X3
            size={26}
            strokeWidth={1.5}
          />

          <div>
            <span className="block">
              past
            </span>

            <span className="block">
              boards
            </span>
          </div>
        </Link>

        <Link
          href="/closet"
          className="
            flex
            w-full
            flex-col
            items-center
            gap-2
            rounded-xl
            px-3
            py-3
            text-center
            text-[#4D5382]
            font-medium
            text-[#4D5382]
            hover:bg-black/5
          "
        >
          <Shirt
            size={28}
            strokeWidth={1.7}
          />

          <span>
            closet
          </span>
        </Link>
      </div>


      <div className="flex justify-center pb-2">
        <Show when="signed-out">
          <SignInButton mode="modal">
            <button
              type="button"
              className="
                flex
                flex-col
                items-center
                gap-2
                rounded-xl
                px-3
                py-3
                font-medium
                text-[#4D5382]
                hover:bg-black/5
              "
            >
              <User
                size={26}
                strokeWidth={1.7}
              />

              <span>
                login
              </span>
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