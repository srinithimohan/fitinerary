# fitinerary

[![Build](https://github.com/srinithimohan/fitinerary/actions/workflows/build.yml/badge.svg)](https://github.com/srinithimohan/fitinerary/actions/workflows/build.yml)

fitinerary is a full-stack travel wardrobe platform built around making outfit planning and packing more efficient. it lets users upload and organize clothing in a digital closet, build and rearrange outfits using a 3×3 wardrobe grid, save and edit boards, and export them as images. it uses next.js, react, typescript, tailwind css, supabase, and postgresql, with persistent user data and drag-and-drop interactions powered by dnd-kit.

## why i built it

after struggling to pack for a trip with friends, i wanted to build an application that would let me visualize potential outfits and clothing combinations in real time. this project also gave me a focused way to learn full-stack development and take a product from idea to deployment.

## architecture 

```text
client ──> next.js app ──> route handlers ──> supabase ──> postgresql
  │             │
  │             ├── outfit board
  │             ├── closet
  │             └── saved boards
  │
  ├── dnd-kit
  └── canvas api
```

the app uses the next.js app router with react and typescript. application data is persisted through next.js route handlers backed by supabase/postgresql. dnd-kit handles board and closet drag-and-drop interactions, while browser canvas APIs handle board exports.

## tech stack

### language
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)

### frameworks & UI
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)

### data
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)


❀ built by [srinithi](https://github.com/srinithimohan).
