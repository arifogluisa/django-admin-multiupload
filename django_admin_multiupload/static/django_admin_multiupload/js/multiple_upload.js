'use strict';

// Wait for Django's jQuery to be available (supports both standard admin and Grappelli)
(function() {
    function getJQuery() {
        if (typeof django !== 'undefined' && django.jQuery) {
            return django.jQuery;
        }
        if (typeof grp !== 'undefined' && grp.jQuery) {
            return grp.jQuery;
        }
        return null;
    }

    function init() {
        var $ = getJQuery();
        var isGrappelli = typeof grp !== 'undefined';

        function initMultipleUpload(config) {
            var prefix = config.prefix;
            var groupId = prefix + '-group';
            var $group = $('#' + groupId);

            if (!$group.length) {
                console.warn('MultipleUpload: Could not find inline group #' + groupId);
                return;
            }

            // Check if already initialized
            if ($group.data('multiple-upload-initialized')) {
                return;
            }

            // Create upload section HTML
            var dropzoneText = config.dropzone_text || 'Drag files here or click to select';
            var uploadHtml = 
                '<div class="multiple-upload-container" data-upload-field="' + config.upload_field_name + '" data-prefix="' + prefix + '">' +
                    '<div class="multiple-upload-dropzone" id="dropzone-' + prefix + '">' +
                        '<input type="file" ' +
                               'name="' + config.upload_field_name + '" ' +
                               'multiple ' +
                               'id="id_' + config.upload_field_name + '_' + prefix + '" ' +
                               'accept="' + config.accept_types + '" ' +
                               'class="multiple-upload-input">' +
                        '<div class="dropzone-content">' +
                            '<span class="dropzone-icon">📁</span>' +
                            '<span class="dropzone-text">' + dropzoneText + '</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="image-previews" id="previews-' + prefix + '"></div>' +
                '</div>';

            // Insert after the inline heading (h2 element)
            var $heading = $group.find('.inline-heading');
            if ($heading.length) {
                $heading.after(uploadHtml);
            } else {
                // Fallback to beginning of group if no heading found
                if (isGrappelli) {
                    let $inlineRelated = $group.find('.inline-related');
                    $inlineRelated.before(uploadHtml);
                } else {
                    $group.prepend(uploadHtml);
                }
            }
            $group.data('multiple-upload-initialized', true);

            // Initialize the upload functionality
            var $container = $group.find('.multiple-upload-container');
            var $input = $container.find('.multiple-upload-input');
            var $previewsContainer = $container.find('.image-previews');
            var $dropzone = $container.find('.multiple-upload-dropzone');

            // Store File objects for each preview
            var fileMap = new Map();

            // Create error container below dropzone (Django-style)
            var $errorContainer = $('<ul class="errorlist multiple-upload-errors"></ul>');
            $dropzone.after($errorContainer);

            // Drag & drop handlers
            $dropzone.on('dragover dragenter', function(e) {
                e.preventDefault();
                e.stopPropagation();
                $(this).addClass('dragover');
            });

            $dropzone.on('dragleave drop', function(e) {
                e.preventDefault();
                e.stopPropagation();
                $(this).removeClass('dragover');
            });

            $dropzone.on('drop', function(e) {
                var files = e.originalEvent.dataTransfer.files;
                $input[0].files = files;
                $input.trigger('change');
            });

            // Click on dropzone to trigger file input
            $dropzone.on('click', function(e) {
                if (!$(e.target).is('input')) {
                    $input.click();
                }
            });

            // Build previews & store File objects
            $input.on('change', function() {
                $previewsContainer.empty();
                $errorContainer.empty();
                fileMap.clear();

                var files = this.files;
                var errors = [];
                var validIndex = 0;

                for (var i = 0; i < files.length; i++) {
                    (function(file) {
                        var deleteText = config.delete_text || 'Delete';

                        // Validate file type
                        var acceptTypes = config.accept_types;
                        if (acceptTypes && acceptTypes !== '*') {
                            var acceptedTypes = acceptTypes.split(',').map(function(t) { return t.trim(); });
                            var fileType = file.type;
                            var fileExtension = '.' + file.name.split('.').pop().toLowerCase();

                            var isAccepted = acceptedTypes.some(function(type) {
                                if (type.indexOf('.') === 0) {
                                    return fileExtension === type.toLowerCase();
                                }
                                if (type.indexOf('/*') !== -1) {
                                    var baseType = type.split('/')[0];
                                    return fileType.indexOf(baseType + '/') === 0;
                                }
                                return fileType === type;
                            });

                            if (!isAccepted) {
                                // Skip invalid file - just show error
                                var errorMsg = '"' + file.name + '": ' + config.error_invalid_image;
                                errors.push(errorMsg);
                                return; // Don't add to preview or fileMap
                            }
                        }

                        // Only process valid files
                        var previewId = 'preview-' + prefix + '-' + validIndex++;

                        if (file.type.indexOf('image/') === 0) {
                            var reader = new FileReader();
                            reader.onload = function(e) {
                                var $wrapper = createPreviewWrapper(previewId, file.name, e.target.result, true, deleteText);
                                $previewsContainer.append($wrapper);
                                fileMap.set(previewId, file);
                                // Rebuild input with only valid files
                                rebuildFileInput($input, fileMap);
                            };
                            reader.readAsDataURL(file);
                        } else {
                            var $wrapper = createPreviewWrapper(previewId, file.name, null, false, deleteText);
                            $previewsContainer.append($wrapper);
                            fileMap.set(previewId, file);
                        }
                    })(files[i]);
                }

                // Rebuild input with only valid files (for non-image files)
                rebuildFileInput($input, fileMap);

                // Show errors below dropzone
                if (errors.length > 0) {
                    errors.forEach(function(err) {
                        $errorContainer.append($('<li>').text(err));
                    });
                }
            });

            // Handle remove button clicks
            $previewsContainer.on('click', '.remove-preview', function(e) {
                e.preventDefault();
                e.stopPropagation();

                var $wrapper = $(this).closest('.preview-wrapper');
                var previewId = $wrapper.attr('id');

                // Remove from fileMap
                fileMap.delete(previewId);

                // Remove preview
                $wrapper.remove();

                // Rebuild file input
                rebuildFileInput($input, fileMap);
            });
        }

        function createPreviewWrapper(previewId, fileName, imageSrc, isImage, deleteText) {
            var $wrapper = $('<div>')
                .addClass('preview-wrapper')
                .attr('id', previewId);

            if (isImage && imageSrc) {
                $wrapper.append(
                    $('<img>')
                        .attr('src', imageSrc)
                        .addClass('file-preview')
                        .attr('alt', fileName)
                );
            } else {
                // Get file extension and name
                var parts = fileName.split('.');
                var extension = parts.pop().toUpperCase();
                var nameWithoutExt = parts.join('.');
                var displayName = nameWithoutExt.length > 12 
                    ? nameWithoutExt.substring(0, 12) + '...' 
                    : nameWithoutExt;
                
                var $fileIcon = $('<div>').addClass('file-preview file-icon');
                $fileIcon.append(
                    $('<span>').addClass('file-extension').text(extension)
                );
                $fileIcon.append(
                    $('<span>').addClass('file-name').text(displayName)
                );
                $wrapper.append($fileIcon);
            }

            // Add filename tooltip
            $wrapper.attr('title', fileName);

            // Add remove button
            $wrapper.append(
                $('<button>')
                    .attr('type', 'button')
                    .addClass('remove-preview')
                    .html('&times;')
                    .attr('title', deleteText || 'Delete')
            );

            return $wrapper;
        }

        // Rebuild file input from fileMap
        function rebuildFileInput($input, fileMap) {
            var dt = new DataTransfer();
            fileMap.forEach(function(file) {
                dt.items.add(file);
            });
            $input[0].files = dt.files;
        }

        // Main initialization
        $(document).ready(function() {
            // Check if we have config from the server
            if (!window.MULTIPLE_UPLOAD_CONFIGS || !window.MULTIPLE_UPLOAD_CONFIGS.length) {
                console.log('MultipleUpload: No config found');
                return;
            }

            // Process each config
            window.MULTIPLE_UPLOAD_CONFIGS.forEach(function(config) {
                initMultipleUpload(config);
            });
        });
    }

    // Check if jQuery is available (django.jQuery or grp.jQuery for Grappelli)
    if (getJQuery()) {
        init();
    } else {
        // Wait for DOMContentLoaded and check again
        document.addEventListener('DOMContentLoaded', function() {
            if (getJQuery()) {
                init();
            } else {
                console.error('MultipleUpload: jQuery not available (neither django.jQuery nor grp.jQuery)');
            }
        });
    }
})();
