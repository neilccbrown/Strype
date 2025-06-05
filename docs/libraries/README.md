<img src="../../public/favicon.png" width="64" align="left">

# Guidelines for creating a Strype library

Strype supports libraries; code that can be easily re-used, by yourself or other people.  This document is for library *authors*, describing how to write and share a library for use in Strype.

## Developing and publishing

Strype libraries must be published somewhere accessible to the user's machine before they can be used.

During development you may find it easiest to run a local web server, for example if you have npx (part of node.js) installed, then you can run: `npx serve . -l 8090 --cors` then use the library address `http://localhost:8090/` in Strype.

The easiest place to publish a library for others to use is in a public Github repository, but you can also store it at any public HTTPS URL that supports [CORS](https://en.wikipedia.org/wiki/Cross-origin_resource_sharing).

## Library file structure

```
foo.py                  <-- Or whatever your code is called
src/bar.py              <-- Alternative location is inside src directory

index.txt               <-- Required for non-Github libraries

autocompletion.json     <-- optional, see code completion below

assets/                 <-- optional, see assets below

demos/                  <-- optional, see demos below

```

## Index file

Strype needs to know the files that are available in your library.  On Github this can be done with a file listing, but if you are making your library available by HTTPS then you will need to supply an `index.txt` file at the top level, that lists all the files available in your library.

This includes all .py files, .pyi files (see types, below), assets files, demo files, and other special files like `autocomplete.json`.  It does not need to list `index.txt` itself.  So an example file would have content like this:

```
autocomplete.json
src/mylibrary.py
assets/graphics/mypicture.png
```

Given that you will need such a file if testing your library locally, it is a good idea to supply it even if publishing on Github.

## Telling users how to use your library in Strype

To use your library in Strype, users will need to add a library frame in the imports section at the top.

If you are using Github, the library address looks like this: `github:username/repo/branch`  If you omit the `/branch` part, the name `main` is used for the branch.  So for example, the `k-pet-group` user has a library `mediacomp-strype`, so the library address for its main branch is `github:k-pet-group/mediacomp-strype`.

If you are using HTTPS then the library address is the full URL, including the https prefix, e.g. `https://example.com/mylibrary/`

One nice way to tell users how to use your library is to have a couple of lines ready for the user to paste into their imports section, e.g.

```
#(=> Library:github:k-pet-group/mediacomp-strype
from mediacomp import *
```

The user can then copy and paste those into their imports section and will get the library frame and your suggested import lines.  The `#(=> Library:` is Strype's special prefix for identifying library frames.


## Code

Code is stored in `.py` files, either at the top-level or within a `src/` subdirectory.

Any code that works in Strype should work here; all built-in Python items that Strype supports are available to libraries, as are Strype's own modules (such as `strype.graphics`).

## Demos

Coming soon.

## Assets

You can store image and sound files in an assets subdirectory, for use by Strype's graphics and sound module.  If your library is called "mylibrary" and you have a file called "cat.jpeg" in the assets directory, you can use the code `load_image(":mylibrary:cat.jpeg")` to load it, once you have the right library frame.

Remember that assets must be listed in the `index.txt` file if you have one.

## Code completion

To support code completion in your library (an optional but useful step), you will need to generate an `autocomplete.json` file.  This will generate information about available items, parameter names and documentation.  If you want type inference as well you will need to supply type annotations (see section below).

### Autocomplete file

The tool for generating the file is intertwined with Strype's source code.  The steps to generate this file for your library are as follows:
 - Make sure you have Git and NPM (node.js) installed on your system.
 - Clone the Strype repository:
```
    git clone https://github.com/k-pet-group/Strype.git```
```
 - Install the dependencies:
``` 
    npm install
```
 - If you want to generate your file from your live library, run this command, supplying your library address as described above:
```
    npx cross-env LIBRARY=github:username/repo npm run library:make-ac-json
```
 - If you want to generate your file from a local copy (recommended if you are repeatedly regenerating while you develop), separately go to that directory and run `npx serve . -l 8090 --cors`, then leave that running and from Strype's directory run:
 ```
npx cross-env LIBRARY=http://localhost:8090/ npm run library:make-ac-json
```

This command will generate an `autocomplete.json` file in the Strype directory where you ran the command.  Move that file into your live library -- and if you are using `index.txt`, remember to add `autocomplete.json` to that index file.

### Types

The standard autocomplete will record function and class names and their parameters and documentation.  However, if you want to be able to code complete on the return values of functions, you will need to supply type information.

You can supply types either by using a separate .pyi file of the same name as your module, or by inserting special `# type: ` comments into the source.  We suggest the latter is easiest for keeping them in sync.  Here's an example:

```
import strype.graphics as _graphics
def makePicture(path):
    # type: (str) -> _graphics.Image
    """
    Another name for load_image
    """
    return _graphics.load_image(path)
```

Note that Strype does not currently support types within the Python source itself; they must be in these special comments.

### Hiding dependencies

Python has the behaviour that anything imported into your module is automatically re-exported, which can be confusing for beginners and can expose implementation details.  To help avoid this, Strype's autocomplete hides anything beginning with underscore, and we recommend that all your imports use an alias with a leading underscore, for example:

```
import strype.graphics as _graphics
import math as _math
```

