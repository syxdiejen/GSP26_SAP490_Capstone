sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/BusyIndicator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "zemail/template/app/util/ErrorHandler"
  ],
  function (
    Controller,
    JSONModel,
    BusyIndicator,
    MessageBox,
    MessageToast,
    ErrorHandler
  ) {
    "use strict";

    return Controller.extend(
      "zemail.template.app.controller.sign.UserSignatureObject",
      {
        onInit: function () {
          this.getView().setModel(
            new JSONModel({
              title: this._getText("signatureCreateTitle"),
              isCreate: true,
            }),
            "viewState",
          );

          this.getOwnerComponent()
            .getRouter()
            .getRoute("signobject")
            .attachPatternMatched(this._onObjectMatched, this);

          this.getOwnerComponent()
            .getRouter()
            .getRoute("signcreate")
            .attachPatternMatched(this._onCreateMatched, this);
        },

        _onCreateMatched: function () {
          this.getView().unbindElement();

          this.getView().getModel("viewState").setData({
            title: this._getText("signatureCreateTitle"),
            isCreate: true,
          });

          this.byId("inpSignName").setValue("");
          this.byId("swDefault").setState(false);
          this.byId("signatureEditor").setValue("");
        },

        _onObjectMatched: function (oEvent) {
          var oArgs = oEvent.getParameter("arguments");
          var sSignId = decodeURIComponent(oArgs.SignId || "");
          var bIsActiveEntity = oArgs.IsActiveEntity === "true";
          var oModel = this.getOwnerComponent().getModel();

          var sPath = oModel.createKey("/UserSignature", {
            SignId: sSignId,
            IsActiveEntity: bIsActiveEntity,
          });

          this.getView().bindElement({
            path: sPath,
            events: {
              dataRequested: function () {
                this._showBusy();
              }.bind(this),

              dataReceived: function () {
                this._hideBusy();
              }.bind(this),
            },
          });

          this.getView()
            .getModel("viewState")
            .setData({
              title: bIsActiveEntity ? this._getText("signatureDisplayTitle") : this._getText("signatureEditTitle"),
              isCreate: false,
            });
        },

        _validateBeforeSave: function (oPayload) {
          if (!oPayload.SignName) {
            MessageBox.warning(this._getText("signatureNameRequired"));
            return false;
          }

          if (!oPayload.Content) {
            MessageBox.warning(this._getText("signatureContentRequired"));
            return false;
          }

          return true;
        },

        _getPayloadFromView: function () {
          return {
            SignName: this.byId("inpSignName").getValue(),
            IsDefault: this.byId("swDefault").getState(),
            Content: this.byId("signatureEditor").getValue(),
          };
        },

        onSavePress: function () {
          var oModel = this.getOwnerComponent().getModel();
          var oViewState = this.getView().getModel("viewState");
          var bIsCreate = oViewState.getProperty("/isCreate");
          var oPayload = this._getPayloadFromView();
          var that = this;

          if (!this._validateBeforeSave(oPayload)) {
            return;
          }

          this._showBusy();

          if (bIsCreate) {
            oModel.create("/UserSignature", oPayload, {
              success: function (oCreated) {
                that._hideBusy();
                MessageToast.show(that._getText("signatureDraftSaved"));

                that._navToObject(oCreated.SignId, false, true);
              },
              error: function (oError) {
                that._hideBusy();
                ErrorHandler.show(oError, that._getBundle(), "signatureDraftSaveFailed");
              },
            });
          } else {
            var oCtx = this.getView().getBindingContext();
            if (!oCtx) {
              that._hideBusy();
              MessageBox.error(this._getText("signatureNoContext"));
              return;
            }

            var oObj = oCtx.getObject();

            if (oObj.IsActiveEntity === true) {
              that._hideBusy();
              MessageBox.warning(this._getText("signatureActiveSaveWarning"));
              return;
            }

            oModel.update(oCtx.getPath(), oPayload, {
              success: function () {
                that._hideBusy();
                MessageToast.show(that._getText("signatureDraftUpdated"));
              },
              error: function (oError) {
                that._hideBusy();
                ErrorHandler.show(oError, that._getBundle(), "signatureDraftUpdateFailed");
              },
            });
          }
        },

        onActivatePress: function () {
          var oModel = this.getOwnerComponent().getModel();
          var oViewState = this.getView().getModel("viewState");
          var bIsCreate = oViewState.getProperty("/isCreate");
          var oPayload = this._getPayloadFromView();
          var that = this;

          if (!this._validateBeforeSave(oPayload)) {
            return;
          }

          this._showBusy();

          if (bIsCreate) {
            oModel.create("/UserSignature", oPayload, {
              success: function (oCreated) {
                that._activateSignature(oCreated.SignId);
              },
              error: function (oError) {
                that._hideBusy();
                ErrorHandler.show(oError, that._getBundle(), "signatureCreateBeforePublishFailed");
              },
            });
          } else {
            var oCtx = this.getView().getBindingContext();
            if (!oCtx) {
              that._hideBusy();
              MessageBox.error(this._getText("signatureNoContext"));
              return;
            }

            var oObj = oCtx.getObject();

            // nếu đang mở active entity thì phải tạo draft trước khi activate là sai logic
            // activate chỉ áp dụng cho draft
            if (oObj.IsActiveEntity === true) {
              that._hideBusy();
              MessageBox.warning(this._getText("signatureActivePublishWarning"));
              return;
            }

            // lưu thay đổi draft trước rồi activate
            oModel.update(oCtx.getPath(), oPayload, {
              success: function () {
                that._activateSignature(oObj.SignId);
              },
              error: function (oError) {
                that._hideBusy();
                ErrorHandler.show(oError, that._getBundle(), "signatureSaveBeforePublishFailed");
              },
            });
          }
        },

        onDeletePress: function () {
          var oViewState = this.getView().getModel("viewState");
          var bIsCreate = oViewState.getProperty("/isCreate");
          var oModel = this.getOwnerComponent().getModel();
          var that = this;

          if (bIsCreate) {
            MessageToast.show(this._getText("signatureNoDraftToDelete"));
            return;
          }

          var oCtx = this.getView().getBindingContext();
          if (!oCtx) {
            MessageBox.error(this._getText("signatureNoContext"));
            return;
          }

          var oObj = oCtx.getObject();
  
          MessageBox.confirm(this._getText("signatureDeleteConfirm"), {
            onClose: function (sAction) {
              if (sAction !== MessageBox.Action.OK) {
                return;
              }

              this._showBusy();

              // draft -> xóa trực tiếp draft path
              if (oObj.IsActiveEntity === false) {
                that._discardDraft(oObj, that._navBackToList);
                return;
              }

              // active entity -> frontend-only thì chỉ xóa active nếu backend cho phép
              oModel.remove(oCtx.getPath(), {
                headers: {
                  "If-Match": "*",
                },
                success: function () {
                  that._hideBusy();
                  MessageToast.show(that._getText("signatureDeleted"));
                  that._navBackToList();
                },
                error: function (oError) {
                  that._hideBusy();
                  ErrorHandler.show(oError, that._getBundle(), "signatureDeleteFailed");
                },
              });
            }.bind(this),
          });
        },

        onCancelPress: function () {
          var oCtx = this.getView().getBindingContext();
          var oObj = oCtx && oCtx.getObject();

          if (oObj && oObj.IsActiveEntity === false) {
            MessageBox.confirm(this._getText("signatureCancelDiscardConfirm"), {
              onClose: function (sAction) {
                if (sAction !== MessageBox.Action.OK) {
                  return;
                }

                this._showBusy();
                this._discardDraft(oObj, this._navBackToList);
              }.bind(this),
            });
            return;
          }

          this._navBackToList();
        },

        onSignNameChange: function () {
          var bIsCreate = this.getView()
            .getModel("viewState")
            .getProperty("/isCreate");
          this.getView()
            .getModel("viewState")
            .setProperty(
              "/title",
              bIsCreate ? this._getText("signatureCreateTitle") : this._getText("signatureEditTitle"),
            );
        },

        _navBackToList: function () {
            this.getOwnerComponent().getRouter().navTo("signlist");
        },

        _getText: function (sKey, aArgs) {
          return this.getOwnerComponent()
            .getModel("i18n")
            .getResourceBundle()
            .getText(sKey, aArgs);
        },

        _navToObject: function (sSignId, bIsActiveEntity, bReplace) {
          this.getOwnerComponent().getRouter().navTo(
            "signobject",
            {
              SignId: encodeURIComponent(sSignId),
              IsActiveEntity: String(bIsActiveEntity),
            },
            bReplace
          );
        },

        _showBusy: function () {
          BusyIndicator.show(0);
        },

        _hideBusy: function () {
          BusyIndicator.hide();
        },

        _activateSignature: function (sSignId) {
          var oModel = this.getOwnerComponent().getModel();

          oModel.callFunction("/UserSignatureActivate", {
            method: "POST",
            urlParameters: {
              SignId: sSignId,
              IsActiveEntity: false,
            },
            headers: {
              "If-Match": "*",
            },
            success: function () {
              this._hideBusy();
              MessageToast.show(this._getText("signaturePublishSuccess"));
              this._navBackToList();
            }.bind(this),
            error: function (oError) {
              this._hideBusy();
              ErrorHandler.show(oError, this._getBundle(), "signaturePublishFailed");
            }.bind(this),
          });
        },

        _discardDraft: function (oSignature, fnAfterSuccess) {
          var oModel = this.getOwnerComponent().getModel();

          oModel.callFunction("/UserSignatureDiscard", {
            method: "POST",
            urlParameters: {
              SignId: oSignature.SignId,
              IsActiveEntity: false,
            },
            headers: {
              "If-Match": "*",
            },
            success: function () {
              this._hideBusy();
              MessageToast.show(this._getText("signatureDraftDiscarded"));

              if (fnAfterSuccess) {
                fnAfterSuccess.call(this);
              }
            }.bind(this),
            error: function (oError) {
              this._hideBusy();
              ErrorHandler.show(oError, this._getBundle(), "signatureDraftDiscardFailed");
            }.bind(this),
          });
        },

        _getBundle: function () {
          return this.getOwnerComponent()
            .getModel("i18n")
            .getResourceBundle();
        },
      },
    );
  },
);
