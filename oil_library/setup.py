#!/usr/bin/env python
import os
import glob
import shutil
from subprocess import call

from setuptools import setup, find_packages
from distutils.command.clean import clean
from setuptools import Command

here = os.path.abspath(os.path.dirname(__file__))
README = open(os.path.join(here, 'README.txt')).read()
pkg_name = 'OilLibrary'


def clean_files(del_db=False):
    src = os.path.join(here, r'oil_library')
    to_rm = glob.glob(os.path.join(src, r'*.pyc'))
    to_rm.extend([os.path.join(here, '{0}.egg-info'.format(pkg_name)),
                  os.path.join(here, 'build'),
                  os.path.join(here, 'dist')])
    if del_db:
        to_rm.extend([os.path.join(src, 'OilLib.db')])

    for f in to_rm:
        try:
            if os.path.isdir(f):
                shutil.rmtree(f)
            else:
                os.remove(f)
        except:
            pass

        print "Deleting {0} ..".format(f)


class cleandev(clean):
    description = "cleans files generated by 'develop' mode"

    def run(self):
        clean.run(self)
        clean_files()


class cleanall(clean):
    description = "cleans files generated by 'develop' and SQL lite DB file"

    def run(self):
        clean.run(self)
        clean_files(del_db=True)


class remake_oil_db(Command):
    '''
    Custom command to reconstruct the oil_library database from flat file
    '''
    description = "remake oil_library SQL lite DB from flat file"
    user_options = user_options = []

    def initialize_options(self):
        """init options"""
        pass

    def finalize_options(self):
        """finalize options"""
        pass

    def run(self):
        to_rm = os.path.join(here, r'oil_library', 'OilLib.db')
        os.remove(to_rm)
        print "Deleting {0} ..".format(to_rm)
        call("initialize_OilLibrary_db")
        print 'OilLibrary database successfully generated from file!'


requires = [
    'SQLAlchemy >= 0.9.1',
    'transaction',
    'zope.sqlalchemy',
    'awesome-slugify',
    'hazpy.unit_conversion',
    'pytest',
    'numpy'
    ]

s = setup(name=pkg_name,
          version='0.0',
          description='OilLibrary',
          long_description=README,
          author='ADIOS/GNOME team at NOAA ORR',
          author_email='orr.gnome@noaa.gov',
          url='',
          keywords='adios weathering oilspill modeling',
          packages=find_packages(),
          include_package_data=True,
          install_requires=requires,
          tests_require=requires,
          package_data={'oil_library': ['OilLib',
                                        'tests/*.py',
                                        'tests/sample_data/*']},
          cmdclass={'cleandev': cleandev,
                    'remake_oil_db': remake_oil_db,
                    'cleanall': cleanall},
          entry_points={'console_scripts': [('initialize_OilLibrary_db = '
                                             'oil_library.initializedb'
                                             ':make_db'),
                                            ],
                        }
          )

# make database post install - couldn't call this directly so used
# console script
if 'install' in s.script_args:
    call("initialize_OilLibrary_db")
elif 'develop' in s.script_args:
    if os.path.exists(os.path.join(here, 'oil_library', 'OilLib.db')):
        print 'OilLibrary database exists - do not remake!'
    else:
        call("initialize_OilLibrary_db")
        print 'OilLibrary database successfully generated from file!'