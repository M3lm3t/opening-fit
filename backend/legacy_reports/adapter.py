"""Bind frozen calculations to the current process's I/O configuration.

Each invocation gets its own globals; no swapping process-wide functions or
sys.modules while concurrent Stage 6 jobs execute. Calculation dependencies
come from the reviewed release, not the current analysis package.
"""
from types import FunctionType
from . import pipeline


def bind(runtime):
    namespace = dict(runtime)
    namespace.update(vars(pipeline))
    for name, value in vars(pipeline).items():
        if isinstance(value, FunctionType) and value.__module__ == pipeline.__name__:
            bound = FunctionType(value.__code__, namespace, name, value.__defaults__, value.__closure__)
            bound.__kwdefaults__ = value.__kwdefaults__
            namespace[name] = bound
    return namespace


def run(runtime, *args, **kwargs):
    return bind(runtime)["run_import_route"](*args, **kwargs)
