sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/BusyIndicator",
  ],
  function (Controller, Filter, FilterOperator, MessageBox, MessageToast, BusyIndicator) {
    "use strict";

    return Controller.extend("zemail.template.app.controller.sign.UserSignatureList", {

      onInit: function () {
        this.getOwnerComponent()
          .getRouter()
          .getRoute("signlist")
          .attachPatternMatched(this._onRouteMatched, this);
      },

      _onRouteMatched: function () {
        var oTable = this.byId("signatureTable");
        var oBinding = oTable && oTable.getBinding("items");

        if (oBinding) {
          oBinding.refresh(true);
        }
      },

      /* =========================================================== */
      /* Event handlers                                              */
      /* =========================================================== */
      
      onCreatePress: function () {
        this._createSignatureDraft();
      },

      onItemPress: function (oEvent) {
        var oObj = this._getObjectFromEvent(oEvent);
        this._navToSignature(oObj.SignId, oObj.IsActiveEntity);
      },

      onEditPress: function (oEvent) {
        var oCtx = oEvent.getSource().getBindingContext();
        var oObj = oCtx.getObject();

        if (oObj.IsActiveEntity === false) {
          this._navToSignature(oObj.SignId, false);
          return;
        }

        this._editSignature(oObj);
      },

      onDeletePress: function (oEvent) {
        var oCtx = oEvent.getSource().getBindingContext();
        var oObj = oCtx.getObject();

        MessageBox.confirm(this._getText("signatureDeleteConfirm"), {
          onClose: function (sAction) {
            if (sAction !== MessageBox.Action.OK) {
              return;
            }

            if (oObj.IsActiveEntity === false) {
              this._discardSignatureDraft(oObj);
            } else {
              this._deleteSignature(oCtx);
            }
          }.bind(this),
        });
      },

      onSearch: function () {
        this._applyFilters();
      },

      onDefaultChange: function () {
        this._applyFilters();
      },

      onGoPress: function () {
        this._applyFilters();
      },

      /* =========================================================== */
      /* Signature operations                                        */
      /* =========================================================== */

      _createSignatureDraft: function () {
        var oModel = this.getOwnerComponent().getModel();

        BusyIndicator.show(0);

        oModel.create(
          "/UserSignature",
          {
            SignName: "",
            IsDefault: false,
            Content: "",
          },
          {
            success: function (oCreated) {
              this._hideBusy();
              this._navToSignature(oCreated.SignId, false);
            }.bind(this),

            error: function () {
              this._hideBusy();
              MessageBox.error(this._getText("signatureCreateDraftFailed"));
            }.bind(this),
          }
        );
      },

      _editSignature: function (oSignature) {
        var oModel = this.getOwnerComponent().getModel();

        BusyIndicator.show(0);

        oModel.callFunction("/UserSignatureEdit", {
          method: "POST",
          urlParameters: {
            SignId: oSignature.SignId,
            IsActiveEntity: true,
            PreserveChanges: true,
          },
          headers: {
            "If-Match": "*",
          },
          success: function (oData) {
            this._hideBusy();
            this._navToSignature(oData.SignId, false);
          }.bind(this),

          error: function () {
            this._hideBusy();
            MessageBox.error(this._getText("signatureEditDraftFailed"));
          }.bind(this),
        });
      },

      _discardSignatureDraft: function (oSignature) {
        var oModel = this.getOwnerComponent().getModel();

        BusyIndicator.show(0);

        oModel.callFunction("/UserSignatureDiscard", {
          method: "POST",
          urlParameters: {
            SignId: oSignature.SignId,
            IsActiveEntity: false,
          },
          success: function () {
            this._hideBusy();
            MessageToast.show(this._getText("signatureDraftDiscarded"));
            oModel.refresh(true);
          }.bind(this),

          error: function () {
            this._hideBusy();
            MessageBox.error(this._getText("signatureDraftDiscardFailed"));
          }.bind(this),
        });
      },

      _deleteSignature: function (oContext) {
        var oModel = this.getOwnerComponent().getModel();

        BusyIndicator.show(0);

        oModel.remove(oContext.getPath(), {
          success: function () {
            this._hideBusy();
            MessageToast.show(this._getText("signatureDeleted"));
            oModel.refresh(true);
          }.bind(this),

          error: function () {
            this._hideBusy();
            MessageBox.error(this._getText("signatureDeleteFailed"));
          }.bind(this),
        });
      },

      /* =========================================================== */
      /* Filtering                                                   */
      /* =========================================================== */

      _applyFilters: function () {
        var oBinding = this.byId("signatureTable").getBinding("items");
        var aFilters = this._buildFilters();

        oBinding.filter(aFilters);
      },

      _buildFilters: function () {
        var sKeyword = this.byId("searchField").getValue();
        var sType = this.byId("defaultFilter").getSelectedKey();
        var aFilters = [];

        if (sKeyword) {
          aFilters.push(new Filter("SignName", FilterOperator.Contains, sKeyword));
        }

        if (sType === "DEFAULT") {
          aFilters.push(new Filter("IsDefault", FilterOperator.EQ, true));
        } else if (sType === "NONDEFAULT") {
          aFilters.push(new Filter("IsDefault", FilterOperator.EQ, false));
        } else if (sType === "DRAFT") {
          aFilters.push(new Filter("IsActiveEntity", FilterOperator.EQ, false));
        }

        return aFilters;
      },

      /* =========================================================== */
      /* Helpers                                                     */
      /* =========================================================== */

      _getObjectFromEvent: function (oEvent) {
        return oEvent.getSource().getBindingContext().getObject();
      },

      _navToSignature: function (sSignId, bIsActiveEntity) {
        this.getOwnerComponent().getRouter().navTo("signobject", {
          SignId: encodeURIComponent(sSignId),
          IsActiveEntity: String(bIsActiveEntity),
        });
      },

      _getText: function (sKey, aArgs) {
        return this.getOwnerComponent()
          .getModel("i18n")
          .getResourceBundle()
          .getText(sKey, aArgs);
      },

      _hideBusy: function () {
        BusyIndicator.hide();
      },
    });
  }
);