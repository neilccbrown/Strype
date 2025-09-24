def set_defaults(conf_globals):
    # Set default extensions if not already defined
    conf_globals.setdefault('extensions', []).extend([
        'sphinx.ext.autodoc',
        'sphinx.ext.napoleon',
        'sphinx.ext.intersphinx'
    ])

    conf_globals.setdefault('autoclass_content', 'both')

    conf_globals.setdefault('autodoc_typehints', 'description')

    conf_globals.setdefault('intersphinx_mapping', {
        'python': ('https://docs.python.org/3.7/', None),
        'strype': ('https://strype.org/doc/library', None),
    })

    # -- Options for HTML output -------------------------------------------------
    # https://www.sphinx-doc.org/en/master/usage/configuration.html#options-for-html-output

    conf_globals.setdefault('html_theme', 'classic')
    conf_globals.setdefault('html_static_path', ['_static'])
    conf_globals.setdefault('html_css_files', ['custom.css'])
    conf_globals.setdefault('html_theme_options', { 'stickysidebar': True })


    
