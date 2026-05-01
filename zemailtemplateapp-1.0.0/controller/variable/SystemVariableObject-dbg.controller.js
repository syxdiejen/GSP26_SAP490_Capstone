sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast", 
  "sap/m/MessageBox",
],
  function (Controller, MessageToast, MessageBox) {
    "use strict";

    // Helper: extract the first error from a $batch response object
    function _extractBatchError(oResponse) {
      var aBatch = oResponse && oResponse.__batchResponses;
      if (!aBatch) {
        return null;
      }
      for (var i = 0; i < aBatch.length; i++) {
        var oItem = aBatch[i];
        var aChangeset = oItem && oItem.__changeResponses;
        if (aChangeset) {
          for (var j = 0; j < aChangeset.length; j++) {
            if (aChangeset[j].message) {
              return aChangeset[j];
            }
          }
        }
        if (oItem && oItem.message) {
          return oItem;
        }
      }
      return null;
    }

    // Helper: true when the error object signals an auth failure (401 / 403)
    function _isAuthError(oErr) {
      if (!oErr) {
        return false;
      }
      var code = String(
        oErr.statusCode || (oErr.response && oErr.response.statusCode) || "",
      );
      if (code === "401" || code === "403") {
        return true;
      }
      try {
        var oBody = JSON.parse(
          oErr.responseText ||
            (oErr.response && oErr.response.responseText) ||
            "",
        );
        var sCode = oBody && oBody.error && oBody.error.code;
        if (sCode === "RAP_RUNTIME/026") {
          return true;
        }
      } catch (e) {}
      return false;
    }

    // Helper: parse the most meaningful message text from an OData error response.
    // Scans errordetails first, skipping any RAP_ framework codes.
    // Falls back to top-level message only if it is not a RAP_ code.
    function _parseODataErrorMessage(oError, sFallback) {
      try {
        var sText =
          oError.responseText ||
          (oError.response &&
            (oError.response.responseText || oError.response.body)) ||
          oError.body ||
          "";
        var oBody = JSON.parse(sText);

        var aDetails =
          oBody &&
          oBody.error &&
          oBody.error.innererror &&
          oBody.error.innererror.errordetails;

        // 1. Scan errordetails first — skip RAP_ framework codes
        if (aDetails && aDetails.length > 0) {
          for (var i = 0; i < aDetails.length; i++) {
            var oD = aDetails[i];
            if (oD.message && oD.code && oD.code.indexOf("RAP_") !== 0) {
              return oD.message;
            }
          }
        }

        // 2. Top-level message — only if not a RAP_ code
        var sTopCode = oBody && oBody.error && oBody.error.code;
        var sTop =
          oBody &&
          oBody.error &&
          oBody.error.message &&
          oBody.error.message.value;
        if (sTop && sTopCode && sTopCode.indexOf("RAP_") !== 0) {
          return sTop;
        }

        // 3. First errordetail regardless of code
        if (aDetails && aDetails.length > 0 && aDetails[0].message) {
          return aDetails[0].message;
        }
      } catch (e) {}
      return sFallback;
    }

    // Helper: shared error handler for Prepare and Activate callFunction errors.
    // Reads from responseText errordetails, then sap-message header,
    // then UI5 MessageManager — whichever has a non-RAP_ message first.
    function _handleActivateError(oError, sFallback, oBundle) {
      if (_isAuthError(oError)) {
        MessageBox.error(oBundle.getText("systemVariableAuthFailed"));
        return;
      }

      // 1. Standard responseText / errordetails
      var sMsg = _parseODataErrorMessage(oError, null);

      // 2. sap-message response header
      if (!sMsg) {
        try {
          var sSapMsg =
            oError.response &&
            oError.response.headers &&
            oError.response.headers["sap-message"];
          if (sSapMsg) {
            var oSapMsg = JSON.parse(sSapMsg);
            var aDetails = oSapMsg.details || [];
            for (var k = 0; k < aDetails.length; k++) {
              if (
                aDetails[k].message &&
                aDetails[k].code &&
                aDetails[k].code.indexOf("RAP_") !== 0
              ) {
                sMsg = aDetails[k].message;
                break;
              }
            }
            if (
              !sMsg &&
              oSapMsg.message &&
              oSapMsg.code &&
              oSapMsg.code.indexOf("RAP_") !== 0
            ) {
              sMsg = oSapMsg.message;
            }
          }
        } catch (e) {}
      }

      // 3. UI5 MessageManager (ODataMessageParser stores messages here)
      if (!sMsg) {
        var aMessages = sap.ui
          .getCore()
          .getMessageManager()
          .getMessageModel()
          .getData();

        var oAppMsg = aMessages.find(function (oMsg) {
          return (
            oMsg.type === "Error" &&
            oMsg.message &&
            oMsg.message.indexOf("Resolve data inconsistencies") === -1 &&
            oMsg.message.indexOf("data inconsistencies") === -1 &&
            oMsg.message.indexOf("RAP_") === -1
          );
        });
        sMsg = oAppMsg ? oAppMsg.message : null;
      }

      MessageBox.error(sMsg || sFallback);
    }

    return Controller.extend(
      "zemail.template.app.controller.variable.SystemVariableObject",
      {
        onInit: function () {
          this._oRouter = this.getOwnerComponent().getRouter();
          this._oModel = this.getOwnerComponent().getModel();

          this.getView().setModel(this._oModel, "sysVar");
          this.getView().setModel(
            new sap.ui.model.json.JSONModel({
              mode: "create",
              title: this._getText("systemVariableCreateTitle"),
            }),
            "viewState",
          );

          this._oRouter
            .getRoute("SystemVariableObject")
            .attachPatternMatched(this._onObjectMatched, this);

          this._oRouter
            .getRoute("SystemVariableCreate")
            .attachPatternMatched(this._onCreateMatched, this);
        },

        _onObjectMatched: function (oEvent) {
          var sVarId = oEvent.getParameter("arguments").VarId;
          var vIsActiveEntity = oEvent.getParameter("arguments").IsActiveEntity;
          var bIsActiveEntity = String(vIsActiveEntity) === "true";

          this.getView().getModel("viewState").setData({
            mode: "edit",
            title: this._getText("systemVariableEditTitle"),
          });

          var sPath = this._oModel.createKey("/SystemVariables", {
            VarId: sVarId,
            IsActiveEntity: bIsActiveEntity,
          });

          this.getView().bindElement({
            path: sPath,
            model: "sysVar",
          });
        },

        _onCreateMatched: function () {
          this.getView().getModel("viewState").setData({
            mode: "create",
            title: this._getText("systemVariableCreateTitle"),
          });

          var oContext = this._oModel.createEntry("/SystemVariables", {
            properties: {
              VarName: "",
              Description: "",
              IsMandatory: false,
            },
          });

          this.getView().setBindingContext(oContext, "sysVar");
        },

        onVarNameChange: function (oEvent) {
          var sValue = oEvent.getParameter("value");

          if (!sValue || !sValue.trim()) {
            oEvent.getSource().setValueState("Error");
            oEvent.getSource().setValueStateText(this._getText("systemVariableNameRequired"));
          } else {
            oEvent.getSource().setValueState("None");
          }
        },

        onSavePress: function () {
          var oContext = this.getView().getBindingContext("sysVar");

          if (!oContext) {
            MessageBox.error(this._getText("systemVariableNoDataToSave"));
            return;
          }

          var oData = oContext.getObject();

          if (!oData.VarName || !oData.VarName.trim()) {
            MessageBox.error(this._getText("systemVariableNameRequired"));
            return;
          }

          if (!this._oModel.hasPendingChanges()) {
            var aMessages = sap.ui
              .getCore()
              .getMessageManager()
              .getMessageModel()
              .getData();
            var bHasAuthMsg = aMessages.some(function (oMsg) {
              return (
                oMsg.type === "Error" &&
                (oMsg.message.indexOf("not authorized") > -1 ||
                  oMsg.message.indexOf("RAP_RUNTIME/026") > -1)
              );
            });
            if (bHasAuthMsg) {
              MessageBox.error(
                this._getText("systemVariableAuthFailed")
              );
            } else {
              MessageToast.show(this._getText("systemVariableNoChanges"));
            }
            return;
          }

          var fnRequestFailed = function (oEvent) {
            this._oModel.detachRequestFailed(fnRequestFailed, this);
            var oResponse = oEvent.getParameter("response");
            var iStatus = parseInt(oResponse && oResponse.statusCode, 10);
            if (iStatus === 401 || iStatus === 403) {
              MessageBox.error(
                this._getText("systemVariableAuthFailed")
              );
            }
          }.bind(this);
          this._oModel.attachRequestFailed(fnRequestFailed, this);

          this._oModel.submitChanges({
            success: function (oResponse) {
              this._oModel.detachRequestFailed(fnRequestFailed, this);
              var oBatchErr = _extractBatchError(oResponse);
              if (oBatchErr || _isAuthError(oResponse)) {
                MessageBox.error(
                  this._getText("systemVariableAuthFailed")
                );
                console.error(oBatchErr || oResponse);
                return;
              }
              MessageToast.show(this._getText("systemVariableDraftSaved"));
              this._oModel.refresh(true);
            }.bind(this),
            error: function (oError) {
              this._oModel.detachRequestFailed(fnRequestFailed, this);
              if (_isAuthError(oError)) {
                MessageBox.error(
                  this._getText("systemVariableAuthFailed")
                );
              } else {
                MessageBox.error(this._getText("systemVariableDraftSaveFailed"));
              }
              console.error(oError);
            }.bind(this),
          });
        },

        onActivatePress: function () {
          var oContext = this.getView().getBindingContext("sysVar");

          if (!oContext) {
            MessageBox.error(this._getText("systemVariableNoDraftToPublish"));
            return;
          }

          var oData = oContext.getObject();

          if (!oData.VarName || !oData.VarName.trim()) {
            MessageBox.error(this._getText("systemVariableNameRequired"));
            return;
          }

          // Step 3: Call Activate after Prepare succeeds
          var fnCallActivate = function () {
            this._oModel.callFunction("/SystemVariablesActivate", {
              method: "POST",
              urlParameters: {
                VarId: oData.VarId,
                IsActiveEntity: false,
              },
              success: function () {
                MessageToast.show(this._getText("systemVariablePublishSuccess"));
                this._oRouter.navTo("variablelist");
              }.bind(this),
              error: function (oError) {
                _handleActivateError(
                  oError,
                  this._getText("systemVariablePublishFailed"),
                  this._getBundle()
                );
                console.error(oError);
              }.bind(this),
            });
          }.bind(this);

          // Step 2: ALWAYS call Prepare before Activate.
          // Prepare triggers ValidateVarName on the ABAP side.
          // If Prepare fails → custom validation message is returned here.
          // If Prepare succeeds → call Activate.
          var fnCallPrepare = function () {
            this._oModel.callFunction("/SystemVariablesPrepare", {
              method: "POST",
              urlParameters: {
                VarId: oData.VarId,
                IsActiveEntity: false,
              },
              success: function () {
                fnCallActivate();
              }.bind(this),
              error: function (oError) {
                // ValidateVarName failed → show your custom message
                _handleActivateError(oError, this._getText("systemVariableInvalidData"), this._getBundle());
                console.error(oError);
              }.bind(this),
            });
          }.bind(this);

          // Step 1: If there are unsaved field changes, submit them first,
          // then Prepare → Activate.
          // If no pending changes, go straight to Prepare → Activate.
          if (this._oModel.hasPendingChanges()) {
            this._oModel.submitChanges({
              success: function (oResponse) {
                var oBatchErr = _extractBatchError(oResponse);
                if (oBatchErr) {
                  if (_isAuthError(oBatchErr)) {
                    MessageBox.error(
                      this._getText("systemVariableAuthFailed")
                    );
                  } else {
                    var sBatchMsg = _parseODataErrorMessage(
                      oBatchErr,
                      this._getText("systemVariableDraftSaveFailed")
                    );
                    MessageBox.error(sBatchMsg);
                  }
                  console.error(oBatchErr);
                  return;
                }
                // Changes saved → Prepare → Activate
                fnCallPrepare();
              }.bind(this),
              error: function (oError) {
                if (_isAuthError(oError)) {
                  MessageBox.error(
                    this._getText("systemVariableAuthFailed")
                  );
                } else {
                  MessageBox.error(this._getText("systemVariableDraftSaveFailed"));
                }
                console.error(oError);
              }.bind(this),
            });
          } else {
            // No pending changes → Prepare → Activate directly
            fnCallPrepare();
          }
        },

        onCancelPress: function () {
          var oContext = this.getView().getBindingContext("sysVar");

          if (!oContext) {
            this._oRouter.navTo("variablelist");
            return;
          }

          var oData = oContext.getObject();

          if (oData.IsActiveEntity === false) {
            this._oModel.callFunction("/SystemVariablesDiscard", {
              method: "POST",
              urlParameters: {
                VarId: oData.VarId,
                IsActiveEntity: false,
              },
              success: function () {
                MessageToast.show(this._getText("systemVariableDraftDiscarded"));
                this._oModel.refresh(true);
                this._oRouter.navTo("variablelist");
              }.bind(this),
              error: function (oError) {
                var sMsg = "";
                try {
                  sMsg =
                    JSON.parse(oError.responseText).error.message.value || "";
                } catch (e) {}

                if (
                  oError.statusCode === 404 ||
                  sMsg.indexOf("does not exist") > -1
                ) {
                  this._oModel.refresh(true);
                  this._oRouter.navTo("variablelist");
                  return;
                }

                MessageBox.error(this._getText("systemVariableDraftDiscardFailed"));
                console.error(oError);
              }.bind(this),
            });
          } else {
            this._oRouter.navTo("variablelist");
          }
        },

        _getBundle: function () {
          return this.getOwnerComponent()
            .getModel("i18n")
            .getResourceBundle();
        },

        _getText: function (sKey, aArgs) {
          return this._getBundle().getText(sKey, aArgs);
        },
      },
    );
  },
);
