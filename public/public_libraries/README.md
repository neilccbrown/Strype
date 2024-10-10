Python libraries
===

This directory is for us to place Python libraries that we want to be able to import in Strype.  There are several steps to adding a new library:

  1. Add a new Python file in this directory, e.g. `nccb_library.py` (and add the file to Git!).  Imports from these files is so far untested, although I expect it will work if the files you import are in Skulpt (and definitely won't work if they are not).
  2. In the file `ac-skulpt.ts`, find the definition of `OUR_PUBLIC_LIBRARY_FILES` and add the filename in the list.  Without this, Strype will not pick up the new file.
  3. Re-run the NPM task `preprocess:update-skulpt-api`.  Without this, Strype will not show the module and its contents in the auto-complete.
  4. Commit your file (e.g. `nccb_library.py`), `ac-skulpt.ts` and the modified `skulpt-api.json` file to the repository.
