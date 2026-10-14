# Stub of the JS bridge module, used only so Sphinx can import the strype package.
# Any attribute lookup returns a no-op placeholder.
def __getattr__(name):
    return lambda *args, **kwargs: None
