import Link from 'next/link';


export default function Navbar(){
    return(
        <nav>
            <Link href="/">Home</Link>
            <Link href="/past-boards">Past Boards</Link>
            <Link href="/closet">Closet</Link>
            <Link href="/login">Login</Link>
        </nav>
    );
}