"use client";

import Image from "next/image";
import React, { Component } from "react";
import { GlobeAltIcon, MagnifyingGlassIcon, UserCircleIcon, Bars3BottomLeftIcon } from "@heroicons/react/24/solid";

export class Header extends Component {
  render() {
    return (
      <header className="sticky top-0 z-50 grid grid-cols-3 items-center bg-white shadow-md p-2">
        {/* Left */}
        <div className="relative flex items-center h-15 cursor-pointer my-auto w-24">
          <Image
            src="/logo.png"
            fill
            alt="Instacares Logo"
            style={{ objectFit: "contain" }}
          />
        </div>
        {/* Middle */}
        
        <div className="flex items-center md:border-1 rounded-full py-0 h-10 md:shadow-sm">
          <input className="flex-grow pl-5 bg-transparent outline-none text-sm text-gray-600 placeholder-gray-400"
            type="text"
            placeholder="Start your search"
          />
          <MagnifyingGlassIcon className="hidden md:inline-flex h-7 bg-red-400 text-white rounded-full p-2 cursor-pointer md:mx-2" />
        </div>

        {/* Right */}
        <div className="flex items-center space-x-3 justify-end text-gray-500">
            <p className="hidden md:inline-flex cursor-pointer">Sign Up</p>
            <GlobeAltIcon className="h-5 cursor-pointer" />

          <div className="flex item-center space-x-2 border-2 p-1 rounded-full cursor-pointer">
            <Bars3BottomLeftIcon className="h-6" />
            <UserCircleIcon className="h-6" />
          </div>
        </div>
      </header>
    );
  }
}

export default Header;