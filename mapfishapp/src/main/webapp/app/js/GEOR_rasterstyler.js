/*
 * Copyright (C) Camptocamp
 *
 * This file is part of geOrchestra
 *
 * geOrchestra is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with geOrchestra.  If not, see <http://www.gnu.org/licenses/>.
 */

/*
 * @include OpenLayers/Request.js
 * @include OpenLayers/Rule.js
 * @include OpenLayers/Format/SLD/v1_0_0.js
 * @include Ext.ux/widgets/colorpicker/ColorPicker.js
 * @include Ext.ux/widgets/colorpicker/ColorPickerField.js
 * @include GEOR_ows.js
 * @include GEOR_config.js
 * @include GEOR_util.js
 */

Ext.namespace("GEOR");

GEOR.rasterstyler = (function() {
    /*
     * Private
     */

    var observable = new Ext.util.Observable();
    observable.addEvents(
        /**
         * Event: sldready
         * Fires when a new sld is ready on the server.
         */
        "sldready"
    );

	/**
     * Property: win
     * {Ext.Window} The styler window.
     */
    var win;

	/**
	 * Property: wmsLayerRecord
	 * {GeoExt.data.LayerRecord} The record representing the WMS layer
     * to style.
	 */
	var wmsLayerRecord;

    /**
     * Property: wcsInfo
     * {Ext.data.Record} A record with WCS information (data fields
     * are "owsType", "owsURL" and "typeName").
     */
    var wcsInfo;

	/**
     * Property: mask
     * {Ext.LoadingMask} The window's loading mask.
     */
    var mask;

    /**
     * Property: sldURL
     * {String} The URL to the SLD document.
     */
    var sldURL;

    /**
     * Property: dirty
     * {Boolean} Is true when the SLD pointed to by sldURL
     * does not match the set of rules in the legend panel.
     */
    var dirty = true; // FIXME: should be false by default and a specific logic should update it to true when grid values change

    /**
     * Property: geometryName
     * {String} The name of the geometry column
     */
    var geometryName;

    /**
     * Property: tr
     * {Function} an alias to OpenLayers.i18n
     */
    var tr;

    var colormapStore, editor, grid, ColormapEntry, colormapTypeStore, colormapTypeCombo;

    var colormapTypeComboValue;

    // array of info extracted from describecoverage
    var bands;

    /**
     * Method: applyStyling
     * Apply the new style to the layer if we have
     * a new style.
     *
     * Parameters:
     * callback - {Function}
     * scope - {Object}
     */
    var applyStyling = function(callback, scope) {
        if (dirty) {
            // refreshing the layer will be done
            // once the SLD is saved
            saveSLD(callback, scope);
        } else {
            if (sldURL) {
                // sldURL matches our set of rules, we
                // fire the "sldready" event.
                observable.fireEvent(
                    "sldready",
                    wmsLayerRecord,
                    sldURL
                );
            }
            callback.apply(scope, [true]);
        }
    };

    /**
     * Method: dlStyle
     * Download a SLD file from created styling
     *
     * Parameters:
     * callback - {Function}
     * scope - {Object}
     */
    var dlStyle = function() {
        var callback = function(ok, sldURL) {
            if (!sldURL) {
                return;
            }
            GEOR.util.urlDialog({
                title: tr("Download style"),
                msg: tr("You can download your SLD style at ") +
                        '<br /><a href="'+sldURL+'">'+sldURL+'</a>'
            });
        };
        var scope = this;
        if (dirty) {
            // refreshing the layer will not be done
            // in this case (cf third arg)
            saveSLD(callback, scope, false);
        } else {
            sldURL && callback.apply(scope, [true, sldURL]);
        }
    };

    /**
     * Method: saveSLD
     * Build a SLD string from the set of rules and send it to
     * the "ws/sld" web service.
     *
     * Parameters:
     * callback - {Function}
     * scope - {Object}
     * applySLD  - {Boolean} should we apply the style when done - defaults to true
     */
    var saveSLD = function(callback, scope, applySLD) {

        var entries = [];
        colormapStore.each(function(entry){
            entries.push({
                "color": entry.get("color"),
                "quantity": entry.get("quantity"),
                "label": entry.get("label"),
                "opacity": entry.get("opacity")
            });
        });

        var ok = true,
            rules = [new OpenLayers.Rule({
                "name": "my rule name", // FIXME
                "title": "my rule title",
                "symbolizer": {
                    "Raster": new OpenLayers.Symbolizer.Raster({
                        "channelSelection": {
                            "grayChannel": {
                                "sourceChannelName": 1 // FIXME : get from combo
                            }
                        },
                        "geometry": {
                            "property": "geom" // ??
                        },
                        "opacity": "1",
                        "colorMap": {
                            "entries": entries,
                            "type": colormapTypeCombo.getValue()
                        }
                    })
                }
            })
        ];

        applySLD = (applySLD !== false) ? true : false;
        if (rules && rules.length > 0) {
            var data = createSLD(rules);

            if (data === null) {
                ok = false;
            } else {
                // define the callbacks
                var success = function(response) {
                    sldURL = [
                        window.location.protocol, '//', window.location.host,
                        GEOR.config.PATHNAME, '/',
                        Ext.decode(response.responseText).filepath
                    ].join('');
                    applySLD && observable.fireEvent(
                        "sldready",
                        wmsLayerRecord,
                        sldURL
                    );
                    // indicate that the SLD at sldURL matches
                    // our set of rules
                    dirty = false;

                    mask.hide();
                    callback.apply(scope, [true, sldURL]);
                };
                var failure = function(response) {
                    mask.hide();
                    callback.apply(scope, [false]);
                };
                mask.msg = tr("Saving SLD");
                mask.show();
                Ext.Ajax.request({
                    url: GEOR.config.PATHNAME + "/ws/sld/",
                    method: "POST",
                    headers: {
                        "Content-Type": "application/vnd.ogc.sld+xml; charset=UTF-8"
                    },
                    xmlData: data,
                    success: success,
                    failure: failure
                });
            }
        }
        callback.apply(scope,  [ok]);
    };

    /**
     * Method: createSLD
     * Create a SLD from a set of rules.
     *
     * Parameters:
     * {Array({OpenLayers.Rule})} The set of rules.
     *
     * Returns:
     * {String} The SLD string.
     */
    var createSLD = function(rules) {

        return new OpenLayers.Format.SLD().write({
            "namedLayers": [{
                "name": wcsInfo.get("identifier"),
                "userStyles": [
                    new OpenLayers.Style(undefined, {
                        title: "my style title",
                        description: "my style description", // FIXME
                        rules: rules
                    })
                ]
            }]
        });
    };

    /**
     * Method: getSLD
     * Get a SLD from the "ws/sld" web service.
     *
     * Parameters:
     * url - {String} The URL to the SLD doc.
     */
    var getSLD = function(url) {
        if (!url) {
            return;
        }
        mask.msg = tr("Get SLD");
        mask.show();
        // define the callbacks
        var success = function(request) {
            var doc = request.responseXML;
            if (!doc || !doc.documentElement) {
                doc = request.responseText;
            }
            var sld = new OpenLayers.Format.SLD().read(doc, {
                namedLayersAsArray: true
            });
            var rules =
                sld &&
                sld.namedLayers &&
                sld.namedLayers.length > 0 &&
                sld.namedLayers[0].name == wcsInfo.get("identifier") &&
                sld.namedLayers[0].userStyles &&
                sld.namedLayers[0].userStyles.length > 0 &&
                sld.namedLayers[0].userStyles[0].rules;
            if (rules && rules[0]) {
                // use the rules to build the store again
                var s = rules[0].symbolizer.Raster;
                Ext.each(s.colorMap.entries, function(entry) {
                    colormapStore.add(new ColormapEntry({
                        quantity: entry.quantity,
                        label: entry.label,
                        opacity: entry.opacity,
                        color: entry.color
                    }))
                });
                // TODO: restore the colormap type from style
                //colormapTypeCombo.selectByValue(c.type); // FIXME : combo UI does not exist yet !
                colormapTypeComboValue = s.colorMap.type; // FIXME : does not work either because combo has already been created.
                //debugger;
                
                // TODO: restore the band selection from style
                // valeur = s.channelSelection.grayChannel.sourceChannelName

                mask.hide();
                dirty = false;
                sldURL = url;
            } else {
                mask.hide();
                Ext.Msg.alert(
                    tr("Error"),
                    tr("Malformed SLD")
                );
            }
        };
        var failure = function(request) {
            mask.hide();
        };
        Ext.Ajax.request({
            method: "GET",
            url: url,
            success: success,
            failure: failure
        });
    };

    /**
     * Method: createEmptyEntry
     */
    var createEmptyEntry = function() {
        var e = new ColormapEntry({
            quantity: '0.0',
            label: '',
            opacity: 1.0,
            color: '#FFFFFF'
        });
        editor.stopEditing();
        //colormapStore.insert(0, e); // TODO: insert at the bottom ?
        colormapStore.add(e);
        grid.getView().refresh();
        grid.getSelectionModel().selectLastRow();
        editor.startEditing(e);
    };

    /**
     * Method: setDirty
     */
    var setDirty =  function(){
        dirty = true;
    };

    /**
     * Method: initStyler.
     * This method is executed once the WMSDescribeLayerStore
     * is loaded, it is responsible for initializing the styler.
     *
     * Parameters:
     * sType - {Object} The symbol type
     */
    var initStyler = function(sType) {

        // TODO: get band data from DescribeCoverage request
        var bandStore = new Ext.data.ArrayStore({
            fields: ['key'],
            data: bands
        });

        ColormapEntry = Ext.data.Record.create([{
            name: 'quantity',
            type: 'float'
        }, {
            name: 'label',
            type: 'string'
        }, {
            name: 'opacity',
            type: 'float'
        },{
            name: 'color',
            type: 'string'
        }]);

        colormapStore = new Ext.data.Store({
            recordType: ColormapEntry,
            sortInfo: {
                field: 'quantity',
                direction: 'ASC'
            },
            listeners: {
                // we need to mark the sld as dirty when the user changes the colormap:
                "update": setDirty,
                "remove": setDirty
            }
        });

        editor = new Ext.ux.grid.RowEditor({
            saveText: tr('Update'),
            listeners: {
                "afteredit": function() {
                    colormapStore.sort("quantity", "ASC");
                }
            }
        });

        colormapTypeCombo = new Ext.form.ComboBox({
            store: colormapTypeStore,
            displayField: "display",
            valueField: "value",
            fieldLabel: tr("Colormap type"),
            width: 110,
            forceSelection: true,
            editable: false,
            mode: "local",
            triggerAction: "all",
            value: colormapTypeComboValue || colormapTypeStore.getAt(0).get("value"), // FIXME
            listeners: {
                // we need to mark the sld as dirty when the user changes the value:
                "change": setDirty
            }
        });

        grid = new Ext.grid.GridPanel({
            store: colormapStore,
            border: false,
            width: 600,
            region:'center',
            //margins: '0 5 5 5',
            autoExpandColumn: 'label',
            plugins: [editor],
            viewConfig: {
                markDirty: false
            },
            bbar: [{
                iconCls: "add",
                text: tr("Add colormap entry"),
                tooltip: tr("Add a colormap entry"),
                handler: createEmptyEntry
            }, {
                iconCls: "delete",
                text: tr("Remove colormap entry"),
                tooltip: tr("Remove the selected colormap entry"),
                //disabled: true,
                handler: function(btn, evt) {
                    editor.stopEditing();
                    var s = grid.getSelectionModel().getSelections();
                    for(var i = 0, r; r = s[i]; i++){
                        colormapStore.remove(r);
                    }
                }
            }],
            columns: [{
                id: 'quantity',
                xtype: 'numbercolumn',
                header: 'Quantity',
                dataIndex: 'quantity',
                width: 80,
                sortable: true,
                editor: {
                    xtype: 'numberfield',
                    allowBlank: false,
                    emptyText: "NODATA" // FIXME
                }
            },{
                header: 'Label',
                id: 'label',
                dataIndex: 'label',
                width: 100,
                editor: {
                    xtype: 'textfield',
                    allowBlank: true
                }
            },{
                header: 'Opacity',
                xtype: 'numbercolumn',
                dataIndex: 'opacity',
                width: 60,
                sortable: true,
                editor: {
                    xtype: 'numberfield',
                    allowBlank: false,
                    defaultValue: 1,
                    minValue: 0,
                    maxValue: 1
                }
            },{
                header: 'Color',
                dataIndex: 'color',
                width: 100,
                editor: {
                    xtype: 'colorpickerfield', // TODO: add dependency
                    allowBlank: false
                },
                renderer: function(value, metadata, r) {
                    metadata.style += "background-color: "+value+";";
                }
            }]/*,
            listeners: {
                "afterrender": function() {
                    if (!colormapStore.getCount()) {
                        createEmptyEntry();
                    }
                }
            }*/
        });

        /*
         * populate the legend container if the layer
         * has an SLD param
         */
        var url = wmsLayerRecord.get("layer").params.SLD;
        if (url) {
            getSLD(url);
        } else {
            //if (!colormapStore.getCount()) {
                //createEmptyEntry();
            //}
        }

        /*
         * add the legend and styler containers to the styler
         * window and enable it
         */
        win.add({
            layout: "border",
            border: false,
            defaults: {border: false},
            items: [{
                region: "north",
                height: 45,
                //xtype: 'form',
                layout: 'column',
                bodyStyle: 'padding:10px;',
                defaults: {
                    border: false,
                    labelSeparator: tr("labelSeparator")
                },
                items: [{
                    columnWidth: .5,
                    layout: 'form',
                    labelWidth: 50,
                    items: [{
                        xtype: "combo",
                        store: bandStore,
                        displayField: "key",
                        valueField: "key",
                        fieldLabel: tr("Band"),
                        width: 110,
                        forceSelection: true,
                        editable: false,
                        mode: "local",
                        triggerAction: "all",
                        value: bandStore.getAt(0).get("key")
                    }]
                }, {
                    columnWidth: .5,
                    layout: 'form',
                    labelWidth: 100,
                    items: [colormapTypeCombo]
                }]
            }, {
                region: "center",
                layout: "fit",
                items: grid
            }]
        });
        win.doLayout();
        win.enable();
        // if url is defined getURL takes care
        // of hiding the mask
        if (!url) {
            mask && mask.hide();
        }
    };


	/*
     * Public
     */
    return {

        /*
         * Observable object
         */
        events: observable,

        /**
         * APIMethod: deactivate
         *
         */
        deactivate: function() {
            mask && mask.hide();
            win && win.close();
        },

        /**
         * APIMethod: create
         * Create and open the styler window.
         *
         * Parameters:
         * layerRecord - {GeoExt.data.LayerRecord} The record representing
         * the WMS layer to style.
         * animateFrom - {String} Id or element from which the window
         *  should animate while opening
         */
        create: function(layerRecord, animateFrom) {
            Ext.QuickTips.init();
            tr = OpenLayers.i18n;

            // clear cache:
            mask = null;
            wmsLayerRecord = layerRecord;
            bands = [];

            colormapTypeStore = new Ext.data.ArrayStore({
                fields: ['value', 'display'],
                data: [
                    ['ramp', tr('ramp')],
                    ['intervals', tr('intervals')],
                    ['values', tr('values')]
                ]
            });

            /*
             * win is the styler window, create it and display it.
             */
            win = new Ext.Window({
                title: [
                    tr("Raster Styler on "),
                    layerRecord.get("title"),
                    ' (' + layerRecord.get("WCS_typeName") + ')'
                ].join(''),
                layout: "fit",
                width: 500,
                height: 400,
                closeAction: 'close', // window is destroyed when closed
                constrainHeader: true,
                animateTarget: GEOR.config.ANIMATE_WINDOWS && animateFrom,
                modal: false,
                disabled: true,
                buttons: [{
                    text: tr("Close"),
                    handler: function() {
                        win.close();
                    }
                }, {
                    text: tr("Download style"),
                    handler: dlStyle
                }, {
                    text: tr("Apply"),
                    handler: function() {
                        // we're done, apply styling
                        // to layer
                        applyStyling(function(ok){
                            return;
                        });
                    }
                }],
                listeners: {
                    "afterrender": function() {
                        
                        mask = new Ext.LoadMask(win.body, {
                            msg: tr("Loading...")
                        });
                        mask.show();

                    }
                }
            });
            win.show();



            var recordType = Ext.data.Record.create([
                {name: "WCSVersion", type: "string", defaultValue: "1.1.1"},
                {name: "owsURL", type: "string"},
                {name: "identifier", type: "string"}
            ]);
                
            var data = {
                "owsURL": layerRecord.get("WCS_URL"),
                "identifier": layerRecord.get("WCS_typeName")
            };
            wcsInfo = new recordType(data);
            
            
            

            Ext.Ajax.request({
                url: layerRecord.get("WCS_URL").replace(/\?$/,''),
                method: 'GET',
                disableCaching: false,
                headers: {
                    "Content-Type": "application/xml; charset=UTF-8"
                },
                params: {
                    "SERVICE": "WCS",
                    "REQUEST": "DescribeCoverage",
                    "IDENTIFIERS": layerRecord.get("WCS_typeName"),
                    "VERSION": "1.1.1" // TODO: set the same everywhere in this module
                },
                success: function(resp) {
                    var data = resp.responseXML;
                    if (!data || !data.documentElement) {
                        data = resp.responseText;
                    }
                    var format = new OpenLayers.Format.WCSDescribeCoverage({
                        version: "1.1.1"
                    });
                    var o = format.read(data),
                        desc = o && o.coverageDescriptions[layerRecord.get("WCS_typeName")],
                        // there are strong assumptions below (1 field / 1 axis)
                        b = desc && desc.range.fields[0].axes[0].availableKeys;

                    Ext.each(b, function(bi) {
                        bands.push([bi, bi]);
                    });
                    
                    initStyler();
                    
                },
                failure: function() {
                    // give up
                    giveup(tr("DescribeCoverage failure"));  // FIXME
                    
                    mask && mask.hide();
                    win.close();
                },
                scope: this
            });
            
        }
    };
})();



/*!
 * Ext JS Library 3.4.0
 * Copyright(c) 2006-2011 Sencha Inc.
 * licensing@sencha.com
 * http://www.sencha.com/license
 */
Ext.ns('Ext.ux.grid');

/**
 * @class Ext.ux.grid.RowEditor
 * @extends Ext.Panel
 * Plugin (ptype = 'roweditor') that adds the ability to rapidly edit full rows in a grid.
 * A validation mode may be enabled which uses AnchorTips to notify the user of all
 * validation errors at once.
 *
 * @ptype roweditor
 */
Ext.ux.grid.RowEditor = Ext.extend(Ext.Panel, {
    floating: true,
    shadow: false,
    layout: 'hbox',
    cls: 'x-small-editor',
    buttonAlign: 'center',
    baseCls: 'x-row-editor',
    elements: 'header,footer,body',
    frameWidth: 5,
    buttonPad: 3,
    clicksToEdit: 'auto',
    monitorValid: true,
    focusDelay: 250,
    errorSummary: true,

    saveText: 'Save',
    cancelText: 'Cancel',
    commitChangesText: 'You need to commit or cancel your changes',
    errorText: 'Errors',

    defaults: {
        normalWidth: true
    },

    initComponent: function(){
        Ext.ux.grid.RowEditor.superclass.initComponent.call(this);
        this.addEvents(
            /**
             * @event beforeedit
             * Fired before the row editor is activated.
             * If the listener returns <tt>false</tt> the editor will not be activated.
             * @param {Ext.ux.grid.RowEditor} roweditor This object
             * @param {Number} rowIndex The rowIndex of the row just edited
             */
            'beforeedit',
            /**
             * @event canceledit
             * Fired when the editor is cancelled.
             * @param {Ext.ux.grid.RowEditor} roweditor This object
             * @param {Boolean} forced True if the cancel button is pressed, false is the editor was invalid.
             */
            'canceledit',
            /**
             * @event validateedit
             * Fired after a row is edited and passes validation.
             * If the listener returns <tt>false</tt> changes to the record will not be set.
             * @param {Ext.ux.grid.RowEditor} roweditor This object
             * @param {Object} changes Object with changes made to the record.
             * @param {Ext.data.Record} r The Record that was edited.
             * @param {Number} rowIndex The rowIndex of the row just edited
             */
            'validateedit',
            /**
             * @event afteredit
             * Fired after a row is edited and passes validation.  This event is fired
             * after the store's update event is fired with this edit.
             * @param {Ext.ux.grid.RowEditor} roweditor This object
             * @param {Object} changes Object with changes made to the record.
             * @param {Ext.data.Record} r The Record that was edited.
             * @param {Number} rowIndex The rowIndex of the row just edited
             */
            'afteredit'
        );
    },

    init: function(grid){
        this.grid = grid;
        this.ownerCt = grid;
        if(this.clicksToEdit === 2){
            grid.on('rowdblclick', this.onRowDblClick, this);
        }else{
            grid.on('rowclick', this.onRowClick, this);
            if(Ext.isIE){
                grid.on('rowdblclick', this.onRowDblClick, this);
            }
        }

        // stopEditing without saving when a record is removed from Store.
        grid.getStore().on('remove', function() {
            this.stopEditing(false);
        },this);

        grid.on({
            scope: this,
            keydown: this.onGridKey,
            columnresize: this.verifyLayout,
            columnmove: this.refreshFields,
            reconfigure: this.refreshFields,
            beforedestroy : this.beforedestroy,
            destroy : this.destroy,
            bodyscroll: {
                buffer: 250,
                fn: this.positionButtons
            }
        });
        grid.getColumnModel().on('hiddenchange', this.verifyLayout, this, {delay:1});
        grid.getView().on('refresh', this.stopEditing.createDelegate(this, []));
    },

    beforedestroy: function() {
        this.stopMonitoring();
        this.grid.getStore().un('remove', this.onStoreRemove, this);
        this.stopEditing(false);
        Ext.destroy(this.btns, this.tooltip);
    },

    refreshFields: function(){
        this.initFields();
        this.verifyLayout();
    },

    isDirty: function(){
        var dirty;
        this.items.each(function(f){
            if(String(this.values[f.id]) !== String(f.getValue())){
                dirty = true;
                return false;
            }
        }, this);
        return dirty;
    },

    startEditing: function(rowIndex, doFocus){
        if(this.editing && this.isDirty()){
            this.showTooltip(this.commitChangesText);
            return;
        }
        if(Ext.isObject(rowIndex)){
            rowIndex = this.grid.getStore().indexOf(rowIndex);
        }
        if(this.fireEvent('beforeedit', this, rowIndex) !== false){
            this.editing = true;
            var g = this.grid, view = g.getView(),
                row = view.getRow(rowIndex),
                record = g.store.getAt(rowIndex);

            this.record = record;
            this.rowIndex = rowIndex;
            this.values = {};
            if(!this.rendered){
                this.render(view.getEditorParent());
            }
            var w = Ext.fly(row).getWidth();
            this.setSize(w);
            if(!this.initialized){
                this.initFields();
            }
            var cm = g.getColumnModel(), fields = this.items.items, f, val;
            for(var i = 0, len = cm.getColumnCount(); i < len; i++){
                val = this.preEditValue(record, cm.getDataIndex(i));
                f = fields[i];
                f.setValue(val);
                this.values[f.id] = Ext.isEmpty(val) ? '' : val;
            }
            this.verifyLayout(true);
            if(!this.isVisible()){
                this.setPagePosition(Ext.fly(row).getXY());
            } else{
                this.el.setXY(Ext.fly(row).getXY(), {duration:0.15});
            }
            if(!this.isVisible()){
                this.show().doLayout();
            }
            if(doFocus !== false){
                this.doFocus.defer(this.focusDelay, this);
            }
        }
    },

    stopEditing : function(saveChanges){
        this.editing = false;
        if(!this.isVisible()){
            return;
        }
        if(saveChanges === false || !this.isValid()){
            this.hide();
            this.fireEvent('canceledit', this, saveChanges === false);
            return;
        }
        var changes = {},
            r = this.record,
            hasChange = false,
            cm = this.grid.colModel,
            fields = this.items.items;
        for(var i = 0, len = cm.getColumnCount(); i < len; i++){
            if(!cm.isHidden(i)){
                var dindex = cm.getDataIndex(i);
                if(!Ext.isEmpty(dindex)){
                    var oldValue = r.data[dindex],
                        value = this.postEditValue(fields[i].getValue(), oldValue, r, dindex);
                    if(String(oldValue) !== String(value)){
                        changes[dindex] = value;
                        hasChange = true;
                    }
                }
            }
        }
        if(hasChange && this.fireEvent('validateedit', this, changes, r, this.rowIndex) !== false){
            r.beginEdit();
            Ext.iterate(changes, function(name, value){
                r.set(name, value);
            });
            r.endEdit();
            this.fireEvent('afteredit', this, changes, r, this.rowIndex);
        } else {
            this.fireEvent('canceledit', this, false);
        }
        this.hide();
    },

    verifyLayout: function(force){
        if(this.el && (this.isVisible() || force === true)){
            var row = this.grid.getView().getRow(this.rowIndex);
            this.setSize(Ext.fly(row).getWidth(), Ext.isIE ? Ext.fly(row).getHeight() + 9 : undefined);
            var cm = this.grid.colModel, fields = this.items.items;
            for(var i = 0, len = cm.getColumnCount(); i < len; i++){
                if(!cm.isHidden(i)){
                    var adjust = 0;
                    if(i === (len - 1)){
                        adjust += 3; // outer padding
                    } else{
                        adjust += 1;
                    }
                    fields[i].show();
                    fields[i].setWidth(cm.getColumnWidth(i) - adjust);
                } else{
                    fields[i].hide();
                }
            }
            this.doLayout();
            this.positionButtons();
        }
    },

    slideHide : function(){
        this.hide();
    },

    initFields: function(){
        var cm = this.grid.getColumnModel(), pm = Ext.layout.ContainerLayout.prototype.parseMargins;
        this.removeAll(false);
        for(var i = 0, len = cm.getColumnCount(); i < len; i++){
            var c = cm.getColumnAt(i),
                ed = c.getEditor();
            if(!ed){
                ed = c.displayEditor || new Ext.form.DisplayField();
            }
            if(i == 0){
                ed.margins = pm('0 1 2 1');
            } else if(i == len - 1){
                ed.margins = pm('0 0 2 1');
            } else{
                if (Ext.isIE) {
                    ed.margins = pm('0 0 2 0');
                }
                else {
                    ed.margins = pm('0 1 2 0');
                }
            }
            ed.setWidth(cm.getColumnWidth(i));
            ed.column = c;
            if(ed.ownerCt !== this){
                ed.on('focus', this.ensureVisible, this);
                ed.on('specialkey', this.onKey, this);
            }
            this.insert(i, ed);
        }
        this.initialized = true;
    },

    onKey: function(f, e){
        if(e.getKey() === e.ENTER){
            this.stopEditing(true);
            e.stopPropagation();
        }
    },

    onGridKey: function(e){
        if(e.getKey() === e.ENTER && !this.isVisible()){
            var r = this.grid.getSelectionModel().getSelected();
            if(r){
                var index = this.grid.store.indexOf(r);
                this.startEditing(index);
                e.stopPropagation();
            }
        }
    },

    ensureVisible: function(editor){
        if(this.isVisible()){
             this.grid.getView().ensureVisible(this.rowIndex, this.grid.colModel.getIndexById(editor.column.id), true);
        }
    },

    onRowClick: function(g, rowIndex, e){
        if(this.clicksToEdit == 'auto'){
            var li = this.lastClickIndex;
            this.lastClickIndex = rowIndex;
            if(li != rowIndex && !this.isVisible()){
                return;
            }
        }
        this.startEditing(rowIndex, false);
        this.doFocus.defer(this.focusDelay, this, [e.getPoint()]);
    },

    onRowDblClick: function(g, rowIndex, e){
        this.startEditing(rowIndex, false);
        this.doFocus.defer(this.focusDelay, this, [e.getPoint()]);
    },

    onRender: function(){
        Ext.ux.grid.RowEditor.superclass.onRender.apply(this, arguments);
        this.el.swallowEvent(['keydown', 'keyup', 'keypress']);
        this.btns = new Ext.Panel({
            baseCls: 'x-plain',
            cls: 'x-btns',
            elements:'body',
            layout: 'table',
            width: (this.minButtonWidth * 2) + (this.frameWidth * 2) + (this.buttonPad * 4), // width must be specified for IE
            items: [{
                ref: 'saveBtn',
                itemId: 'saveBtn',
                xtype: 'button',
                text: this.saveText,
                width: this.minButtonWidth,
                handler: this.stopEditing.createDelegate(this, [true])
            }, {
                xtype: 'button',
                text: this.cancelText,
                width: this.minButtonWidth,
                handler: this.stopEditing.createDelegate(this, [false])
            }]
        });
        this.btns.render(this.bwrap);
    },

    afterRender: function(){
        Ext.ux.grid.RowEditor.superclass.afterRender.apply(this, arguments);
        this.positionButtons();
        if(this.monitorValid){
            this.startMonitoring();
        }
    },

    onShow: function(){
        if(this.monitorValid){
            this.startMonitoring();
        }
        Ext.ux.grid.RowEditor.superclass.onShow.apply(this, arguments);
    },

    onHide: function(){
        Ext.ux.grid.RowEditor.superclass.onHide.apply(this, arguments);
        this.stopMonitoring();
        this.grid.getView().focusRow(this.rowIndex);
    },

    positionButtons: function(){
        if(this.btns){
            var g = this.grid,
                h = this.el.dom.clientHeight,
                view = g.getView(),
                scroll = view.scroller.dom.scrollLeft,
                bw = this.btns.getWidth(),
                width = Math.min(g.getWidth(), g.getColumnModel().getTotalWidth());

            this.btns.el.shift({left: (width/2)-(bw/2)+scroll, top: h - 2, stopFx: true, duration:0.2});
        }
    },

    // private
    preEditValue : function(r, field){
        var value = r.data[field];
        return this.autoEncode && typeof value === 'string' ? Ext.util.Format.htmlDecode(value) : value;
    },

    // private
    postEditValue : function(value, originalValue, r, field){
        return this.autoEncode && typeof value == 'string' ? Ext.util.Format.htmlEncode(value) : value;
    },

    doFocus: function(pt){
        if(this.isVisible()){
            var index = 0,
                cm = this.grid.getColumnModel(),
                c;
            if(pt){
                index = this.getTargetColumnIndex(pt);
            }
            for(var i = index||0, len = cm.getColumnCount(); i < len; i++){
                c = cm.getColumnAt(i);
                if(!c.hidden && c.getEditor()){
                    c.getEditor().focus();
                    break;
                }
            }
        }
    },

    getTargetColumnIndex: function(pt){
        var grid = this.grid,
            v = grid.view,
            x = pt.left,
            cms = grid.colModel.config,
            i = 0,
            match = false;
        for(var len = cms.length, c; c = cms[i]; i++){
            if(!c.hidden){
                if(Ext.fly(v.getHeaderCell(i)).getRegion().right >= x){
                    match = i;
                    break;
                }
            }
        }
        return match;
    },

    startMonitoring : function(){
        if(!this.bound && this.monitorValid){
            this.bound = true;
            Ext.TaskMgr.start({
                run : this.bindHandler,
                interval : this.monitorPoll || 200,
                scope: this
            });
        }
    },

    stopMonitoring : function(){
        this.bound = false;
        if(this.tooltip){
            this.tooltip.hide();
        }
    },

    isValid: function(){
        var valid = true;
        this.items.each(function(f){
            if(!f.isValid(true)){
                valid = false;
                return false;
            }
        });
        return valid;
    },

    // private
    bindHandler : function(){
        if(!this.bound){
            return false; // stops binding
        }
        var valid = this.isValid();
        if(!valid && this.errorSummary){
            this.showTooltip(this.getErrorText().join(''));
        }
        this.btns.saveBtn.setDisabled(!valid);
        this.fireEvent('validation', this, valid);
    },

    lastVisibleColumn : function() {
        var i = this.items.getCount() - 1,
            c;
        for(; i >= 0; i--) {
            c = this.items.items[i];
            if (!c.hidden) {
                return c;
            }
        }
    },

    showTooltip: function(msg){
        var t = this.tooltip;
        if(!t){
            t = this.tooltip = new Ext.ToolTip({
                maxWidth: 600,
                cls: 'errorTip',
                width: 300,
                title: this.errorText,
                autoHide: false,
                anchor: 'left',
                anchorToTarget: true,
                mouseOffset: [40,0]
            });
        }
        var v = this.grid.getView(),
            top = parseInt(this.el.dom.style.top, 10),
            scroll = v.scroller.dom.scrollTop,
            h = this.el.getHeight();

        if(top + h >= scroll){
            t.initTarget(this.lastVisibleColumn().getEl());
            if(!t.rendered){
                t.show();
                t.hide();
            }
            t.body.update(msg);
            t.doAutoWidth(20);
            t.show();
        }else if(t.rendered){
            t.hide();
        }
    },

    getErrorText: function(){
        var data = ['<ul>'];
        this.items.each(function(f){
            if(!f.isValid(true)){
                data.push('<li>', f.getActiveError(), '</li>');
            }
        });
        data.push('</ul>');
        return data;
    }
});
Ext.preg('roweditor', Ext.ux.grid.RowEditor);
