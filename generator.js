'use strict';

var fs = require('fs');
var path = require('path');
var choices = require('./generators/choices');
var choose = require('./lib/choose');
var utils = require('./lib/utils');

module.exports = function(app) {
  if (!utils.isValid(app, 'generate-license')) return;

  /**
   * Plugins
   */

  app.use(require('generate-defaults'));
  app.use(require('./generators/tasks'));

  /**
   * Middleware for renaming dest files
   */

  app.preWrite(/\.tmpl$/, function(file, next) {
    file.basename = 'LICENSE';
    next();
  });

  /**
   * Prompts the user to choose the template to use for generating a `LICENSE`
   * file in the current working directory. This task is also aliased as `choose-license`
   * to provide a semantic name for API usage (e.g. `app.generate('choose-license', cb)`).
   *
   * ```sh
   * $ gen license
   * $ gen license --dest ./docs
   * $ gen dest license
   * # or
   * $ gen license:choose
   * $ gen license:choose --dest ./docs
   * $ gen dest license:choose
   * ```
   * @name license
   * @api public
   */

  app.task('default', ['choose']);
  app.task('choose', function(cb) {
    var options = {
      message: 'Choose the license to generate',
      choices: choices,
      filter: function(str, choice) {
        return new RegExp(str, 'i').test(choice.name[0]) || new RegExp(str, 'i').test(choice.id);
      }
    };
    choose(app, options).then(function(name) {
      app.build(name, cb);
    });
  });

  /**
   * Generate `tasks.js` file
   */

  app.task('create-tasks', function(cb) {
    return app.src('templates/*.tmpl')
      .pipe(tasks({template: 'generators/support/tasks.tmpl'}))
      .pipe(app.renderFile('*'))
      .pipe(app.dest(app.cwd));
  });

  /**
   * Generate `choices.js` file
   */

  app.task('create-choices', function(cb) {
    return app.src('templates/*.tmpl')
      .pipe(tasks({template: 'generators/support/choices.tmpl'}))
      .pipe(app.renderFile('*'))
      .pipe(app.dest(app.cwd));
  });

  app.task('create', ['create-*']);
};

/**
 * Plugin for generating individual gitignore tasks.
 *
 * The alternative would be to load in templates and create tasks on-the-fly,
 * but this approach is much faster and results in a better user experience.
 */

function tasks(options) {
  options = options || {};
  var fp = path.resolve(options.template);
  var tmpl = new utils.File({path: fp, contents: fs.readFileSync(fp)});
  var data = {tasks: []};

  return utils.through.obj(function(file, enc, next) {
    var description = options.description || file.stem;

    if (typeof description === 'function') {
      description = options.description(file);
    }

    var name = file.data['spdx-id'].toLowerCase();
    data.tasks.push({
      alias: 'license',
      deps: file.data.deps,
      path: path.relative(path.resolve('generators'), path.join(file.dirname, name) + '.tmpl'),
      name: name,
      description: file.data.title,
      relative: file.relative
    });

    next();
  }, function(next) {
    data.tasks.sort(function(a, b) {
      if (a.description > b.description) return 1;
      if (a.description < b.description) return -1;
      return 0;
    });

    tmpl.data = data;
    this.push(tmpl);
    next();
  });
}
