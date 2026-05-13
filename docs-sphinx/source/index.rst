Available Python libraries in Strype
==================================== 

Strype comes with `almost all <https://pyodide.org/en/0.29.3/usage/wasm-constraints.html>`__ the standard Python functions, as well as its own graphics and sound libraries which are explained below.

Strype also has various popular Python libraries available for use automatically, including scipy, numpy, pandas, and more.  You can see the full list on the `Pyodide web site <https://pyodide.org/en/0.29.3/usage/packages-in-pyodide.html>`__.
Advanced users can use pure-Python libraries with `micropip <https://micropip.pyodide.org/>`__ via a library frame in the imports section (e.g. "micropip:snowballstemmer" in a library frame).

But for most users, the Strype graphics and sound API below is all that is needed; see the documentation below.

Strype API documentation
========================

You can see more documentation for Strype on the `main documentation page <https://strype.org/doc/>`__

Module strype.graphics
----------------------

.. container:: module-wrapper

  .. container:: module-content

    .. automodule:: strype.graphics
       :members:
       :undoc-members:
       :show-inheritance:

  .. container:: module-indicator

    Module strype.graphics
    
Module strype.sound
-------------------

.. container:: module-wrapper

  .. container:: module-content

    .. automodule:: strype.sound
       :members:
       :undoc-members:
       :show-inheritance:

  .. container:: module-indicator

    Module strype.sound


.. toctree::
   :maxdepth: 2
   :caption: Contents:

