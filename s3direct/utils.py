import hashlib
import hmac

from django.conf import settings


def get_at(index, t):
    try:
        value = t[index]
    except IndexError:
        value = None
    return value


def get_s3direct_destinations():
    """Returns s3direct destinations.

    NOTE: Don't use constant as it will break ability to change at runtime (e.g. tests)
    """
    return getattr(settings, 'S3DIRECT_DESTINATIONS', None)


def get_key(key, file_name, dest):
    if hasattr(key, '__call__'):
        fn_args = [file_name, ]
        args = dest.get('key_args')
        if args:
            fn_args.append(args)
        object_key = key(*fn_args)
    elif key == '/':
        object_key = file_name
    else:
        object_key = '%s/%s' % (key.strip('/'), file_name)
    return object_key
