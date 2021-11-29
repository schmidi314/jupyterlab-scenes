# jupyterlab_scenes

[![Binder](https://mybinder.org/badge_logo.svg)](https://mybinder.org/v2/gh/schmidi314/jupyterlab-scenes/master?urlpath=lab)

Define subsets of code cells as scenes and execute them.

## Usage

* The command "Toggle Scene Cell" attaches a cell to the active scene (or removes it again). Scene membership is indicated by the purple dot at the right end of the cell.
* The active scene is the scene that is currently displayed (purple dots) and can be edited.
* All cells of a scene are executed by clicking the run button in the scene.
* One cell can be part of multiple scenes.

![Basic Usage](https://github.com/schmidi314/jupyterlab-scenes/blob/master/gifs/scenes_basic.gif?raw=true)


* By clicking the `init` button, one scene can be chosen to be automatically executed as the kernel becomes ready (due to a restart or at the initial loading of the notebook).
* If a notebook with an already running kernel is opened, the init scene is __not__ executed.
* Only one scene can be an init scene.

![Initialization](https://github.com/schmidi314/jupyterlab-scenes/blob/master/gifs/scenes_init.gif?raw=true)


## Requirements

* JupyterLab >= 3.0

## Install

To install the extension, execute:

```bash
pip install jupyterlab_scenes
```

## Uninstall

To remove the extension, execute:

```bash
pip uninstall jupyterlab_scenes
```


### Packaging the extension

See [RELEASE](RELEASE.md)
