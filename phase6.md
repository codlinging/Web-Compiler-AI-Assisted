**Phase 6: Compilation & Execution** is the final and most exciting stage of your compiler engine. 

Up until now, Structura.ai has been doing "static analysis"—it reads the Flex/Bison code, checks for errors, asks AI for help, and generates the equivalent C code. 

In Phase 6, we bring that C code to life. We will take the C code generated in Phase 5, compile it into an actual executable program on your backend, and allow the user to feed custom text strings into it to see if their grammar actually works!

Here is how the architecture for Phase 6 works:

### The 4 Steps of Phase 6

1. **File I/O (Backend):** When the user clicks a "Compile & Run" button on the frontend, your Axum server will take the generated C string and save it as a temporary file (e.g., `temp_compiler.c`) on your computer.
2. **Invoking GCC (Backend):** Your Rust server will use the `std::process::Command` library to open a hidden terminal and run `gcc temp_compiler.c -o my_compiler`. This uses your system's actual C compiler to build a binary executable.
3. **Execution & Piped Input (Backend):** The Rust server will then run that new `./my_compiler` binary. It will take a custom string that the user typed in the browser (like `"123 + 456"`) and pipe it directly into the binary's Standard Input (`stdin`).
4. **Capturing the Output (Full Stack):** The compiled program will print its results (Standard Output / `stdout`). Rust will capture this text, package it into a JSON response, and send it back to your Next.js frontend to be displayed in a shiny new "Terminal/Console" UI.

---

### ⚠️ A Note on Security (The "Sandbox")
Before we build this, it is important to know that taking code from a web browser, compiling it, and running it on your server is the most dangerous thing you can do in web development (it's called Remote Code Execution). 

* **For your local university project:** We can safely use standard Rust process commands since it's just running on your own machine.
* **For a real-world startup:** You would *never* run this directly on the host server. You would spin up an isolated Docker container or a WebAssembly sandbox to run the C code so hackers couldn't break into your server. 

### How should we start?
To build Phase 6, we need to do two things:
1. **Frontend:** Add a new "Test Input" text box and a "Console Output" window below your code editor.
2. **Backend:** Write the Rust module that uses `std::process::Command` to run `gcc`.

Which one would you like to build first?